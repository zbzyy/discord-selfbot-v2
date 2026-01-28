/**
 * @fileoverview Discord API service layer.
 * Provides unified interface for Discord operations with rate limiting.
 * @module services/discord
 */

import { getRateLimiter } from '../utils/rate-limiter.js';
import { withRetry } from '../utils/retry.js';
import { getLogger } from '../logger/index.js';
import { ValidationError } from '../errors/index.js';
import { config, validateDiscordId } from '../config/index.js';

/**
 * Discord API service for unified channel and message operations.
 */
export class DiscordService {
    /**
     * Creates a DiscordService instance.
     * @param {Client} selfBotClient - Self-bot client instance
     * @param {Client} commandBotClient - Command bot client instance
     */
    constructor(selfBotClient, commandBotClient) {
        this.selfBotClient = selfBotClient;
        this.commandBotClient = commandBotClient;
        this.rateLimiter = getRateLimiter();
        this.logger = getLogger().child('Discord');
    }

    /**
     * Validates a Discord ID and throws if invalid.
     * @param {string} id - ID to validate
     * @param {string} name - Name for error message
     * @throws {ValidationError} If ID is invalid
     */
    validateId(id, name = 'ID') {
        if (!validateDiscordId(id)) {
            throw new ValidationError(`Invalid ${name} format`, name);
        }
    }

    /**
     * Fetches a channel by ID.
     * @param {string} channelId - Channel ID to fetch
     * @returns {Promise<Channel>} Fetched channel
     */
    async fetchChannel(channelId) {
        this.validateId(channelId, 'Channel ID');

        return withRetry(async () => {
            await this.rateLimiter.wait(`channel:${channelId}`);
            return this.selfBotClient.channels.fetch(channelId);
        }, { context: `fetching channel ${channelId}` });
    }

    /**
     * Fetches a user by ID using the command bot (more reliable).
     * @param {string} userId - User ID to fetch
     * @param {boolean} [force=false] - Force fetch from API
     * @returns {Promise<User>} Fetched user
     */
    async fetchUser(userId, force = false) {
        this.validateId(userId, 'User ID');

        return withRetry(async () => {
            await this.rateLimiter.wait(`user:${userId}`);
            return this.commandBotClient.users.fetch(userId, { force });
        }, { context: `fetching user ${userId}` });
    }

    /**
     * Fetches a user by ID using the self-bot.
     * @param {string} userId - User ID to fetch
     * @returns {Promise<User>} Fetched user
     */
    async fetchUserSelf(userId) {
        this.validateId(userId, 'User ID');

        return withRetry(async () => {
            await this.rateLimiter.wait(`user:${userId}`);
            return this.selfBotClient.users.fetch(userId);
        }, { context: `fetching user ${userId} (self)` });
    }

    /**
     * Creates or gets a DM channel with a user.
     * @param {string} userId - User ID to DM
     * @returns {Promise<DMChannel>} DM channel
     */
    async createDMChannel(userId) {
        const user = await this.fetchUserSelf(userId);
        return user.createDM();
    }

    /**
     * Recursively fetches messages from a channel with progress callbacks.
     * @param {Channel} channel - Channel to fetch from
     * @param {number} limit - Maximum messages to fetch
     * @param {Object} [options={}] - Fetch options
     * @param {function(number, number): void} [options.onProgress] - Progress callback (fetched, total)
     * @param {string} [options.before] - Fetch messages before this ID
     * @returns {Promise<Message[]>} Fetched messages
     */
    async fetchMessages(channel, limit, options = {}) {
        const allMessages = [];
        let lastId = options.before || null;
        let totalFetched = 0;
        const batchSize = 100;

        this.logger.debug(`Starting message fetch from ${channel.id}, limit: ${limit}`);

        while (totalFetched < limit) {
            const fetchCount = Math.min(batchSize, limit - totalFetched);

            try {
                const messages = await withRetry(async () => {
                    await this.rateLimiter.wait(`messages:${channel.id}`);
                    const fetchOptions = { limit: fetchCount };
                    if (lastId) fetchOptions.before = lastId;
                    return channel.messages.fetch(fetchOptions);
                }, { context: `fetching messages in ${channel.id}` });

                if (messages.size === 0) {
                    this.logger.debug('No more messages to fetch');
                    break;
                }

                const messagesArray = Array.from(messages.values());
                allMessages.push(...messagesArray);
                totalFetched += messagesArray.length;
                lastId = messagesArray[messagesArray.length - 1].id;

                // Call progress callback if provided
                if (options.onProgress) {
                    options.onProgress(totalFetched, limit);
                }

                // Log progress
                this.logger.progress(`Fetched ${totalFetched}/${limit} messages...`);

            } catch (error) {
                this.logger.error(`Message fetch aborted: ${error.message}`);
                break;
            }
        }

        this.logger.progressEnd();
        this.logger.plain(`[Discord] Fetched ${allMessages.length} messages from ${channel.id}`);

        return allMessages;
    }

    /**
     * Deletes a message with rate limiting.
     * @param {Message} message - Message to delete
     * @returns {Promise<void>}
     */
    async deleteMessage(message) {
        return withRetry(async () => {
            await this.rateLimiter.wait(`delete:${message.channel.id}`, 'delete');
            return message.delete();
        }, { context: `deleting message ${message.id}` });
    }

    /**
     * Deletes a channel with rate limiting.
     * @param {Channel} channel - Channel to delete
     * @returns {Promise<void>}
     */
    async deleteChannel(channel) {
        return withRetry(async () => {
            await this.rateLimiter.wait(`channel:${channel.id}`, 'delete');
            return channel.delete();
        }, { context: `deleting channel ${channel.id}` });
    }

    /**
     * Deletes a guild (server).
     * @param {Guild} guild - Guild to delete
     * @returns {Promise<void>}
     */
    async deleteGuild(guild) {
        return withRetry(async () => {
            await this.rateLimiter.wait('guild', 'delete');
            return guild.delete();
        }, { context: `deleting guild ${guild.id}` });
    }

    /**
     * Gets all DM channels from cache.
     * @param {number} channelType - DM channel type constant
     * @param {number} groupType - Group DM channel type constant
     * @returns {Channel[]} Array of DM channels
     */
    getDMChannels(channelType, groupType) {
        return Array.from(
            this.selfBotClient.channels.cache
                .filter(c => c.type === channelType || c.type === groupType)
                .values()
        );
    }

    /**
     * Gets guilds owned by the self-bot user.
     * @returns {Guild[]} Array of owned guilds
     */
    getOwnedGuilds() {
        const userId = this.selfBotClient.user.id;
        return Array.from(
            this.selfBotClient.guilds.cache
                .filter(g => g.ownerId === userId)
                .values()
        );
    }

    /**
     * Gets a guild from cache by ID.
     * @param {string} guildId - Guild ID
     * @returns {Guild|undefined} Guild if found
     */
    getCachedGuild(guildId) {
        return this.selfBotClient.guilds.cache.get(guildId);
    }

    /**
     * Gets the self-bot user ID.
     * @returns {string} Self-bot user ID
     */
    getSelfUserId() {
        return this.selfBotClient.user?.id;
    }

    /**
     * Gets the self-bot user tag.
     * @returns {string} Self-bot user tag
     */
    getSelfUserTag() {
        return this.selfBotClient.user?.tag;
    }

    /**
     * Gets the command bot client.
     * @returns {Client} Command bot client
     */
    getCommandClient() {
        return this.commandBotClient;
    }

    /**
     * Gets incoming friend requests.
     * @returns {User[]} Array of users with pending requests
     */
    getIncomingFriendRequests() {
        const requests = this.selfBotClient.relationships?.incoming;
        return requests ? Array.from(requests.values()) : [];
    }

    /**
     * Rejects a friend request.
     * @param {User} user - User whose request to reject
     * @returns {Promise<void>}
     */
    async rejectFriendRequest(user) {
        return withRetry(async () => {
            await this.rateLimiter.wait('relationship', 'delete');
            return user.deleteRelationship();
        }, { context: `rejecting friend request from ${user.tag}` });
    }
}

let discordServiceInstance = null;

/**
 * Initializes the Discord service with clients.
 * @param {Client} selfBotClient - Self-bot client
 * @param {Client} commandBotClient - Command bot client
 * @returns {DiscordService} Discord service instance
 */
export function initDiscordService(selfBotClient, commandBotClient) {
    discordServiceInstance = new DiscordService(selfBotClient, commandBotClient);
    return discordServiceInstance;
}

/**
 * Gets the Discord service instance.
 * @returns {DiscordService} Discord service instance
 * @throws {Error} If not initialized
 */
export function getDiscordService() {
    if (!discordServiceInstance) {
        throw new Error('Discord service not initialized. Call initDiscordService first.');
    }
    return discordServiceInstance;
}

export default {
    DiscordService,
    initDiscordService,
    getDiscordService,
};
