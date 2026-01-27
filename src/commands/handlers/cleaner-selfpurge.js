/**
 * @fileoverview Self-purge command handler.
 * Deletes all your messages in a specific channel.
 * 
 * @warning This is a destructive operation that cannot be undone.
 * @module commands/handlers/cleaner-selfpurge
 */

import { getDiscordService } from '../../services/discord.js';
import { getLogger } from '../../logger/index.js';

/**
 * Handles the /cleaner_selfpurge command.
 * 
 * @warning DESTRUCTIVE: Deletes messages permanently.
 * @param {Interaction} interaction - Discord interaction
 * @returns {Promise<void>}
 */
export async function handleCleanerSelfpurge(interaction) {
    const logger = getLogger();
    const discord = getDiscordService();

    const channelId = interaction.options.getString('channel_id');
    const limit = interaction.options.getInteger('limit');

    // Validate and fetch channel
    discord.validateId(channelId, 'Channel ID');
    const channel = await discord.fetchChannel(channelId);

    if (!channel) {
        throw new Error('Channel not found.');
    }

    logger.warn(`Starting self-purge in channel ${channelId}, checking ${limit} messages`);

    // Fetch messages
    const allMessages = await discord.fetchMessages(channel, limit, {
        onProgress: (fetched, total) => {
            logger.progress(`Scanning ${fetched}/${total} messages...`);
        },
    });

    // Filter to own messages only
    const selfUserId = discord.getSelfUserId();
    const myMessages = allMessages.filter(m => m.author.id === selfUserId);

    if (myMessages.length === 0) {
        await interaction.editReply({
            content: `✅ No messages found to delete in the last ${limit} messages in <#${channelId}>.`,
        });
        return;
    }

    logger.info(`Found ${myMessages.length} messages to delete`);

    // Delete messages
    let deleteCount = 0;
    let errorCount = 0;

    for (const msg of myMessages) {
        try {
            await discord.deleteMessage(msg);
            deleteCount++;
            logger.progress(`Deleted ${deleteCount}/${myMessages.length} messages...`);
        } catch (error) {
            errorCount++;
            logger.error(`Failed to delete message ${msg.id}`, error);
        }
    }

    logger.progressEnd();
    logger.success(`Self-purge complete: ${deleteCount} messages deleted`);

    await interaction.editReply({
        content: `✅ **Operation Complete.**\n` +
            `🗑️ **Deleted:** ${deleteCount} messages\n` +
            `${errorCount > 0 ? `❌ **Errors:** ${errorCount}\n` : ''}` +
            `📍 **Channel:** <#${channelId}>`,
    });
}

export default handleCleanerSelfpurge;