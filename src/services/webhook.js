/**
 * @fileoverview Webhook notification service for Discord.
 * Handles sending embeds and notifications via webhooks.
 * @module services/webhook
 */

import { postJson } from './http.js';
import { withRetry } from '../utils/retry.js';
import { getLogger } from '../logger/index.js';
import { config } from '../config/index.js';

/**
 * Default webhook username.
 * @type {string}
 */
const DEFAULT_USERNAME = 'Automation Suite';

/**
 * Embed color constants.
 * @type {Object}
 */
export const EmbedColors = {
    SUCCESS: 0x57F287,
    ERROR: 0xED4245,
    WARNING: 0xFEE75C,
    INFO: 0x5865F2,
    BLURPLE: 0x5865F2,
};

/**
 * Creates a standardized embed object.
 * @param {Object} options - Embed options
 * @param {string} [options.title] - Embed title
 * @param {string} [options.description] - Embed description
 * @param {number} [options.color] - Embed color
 * @param {Array} [options.fields] - Embed fields
 * @param {Object} [options.footer] - Footer object
 * @param {string} [options.timestamp] - ISO timestamp
 * @param {Object} [options.thumbnail] - Thumbnail object
 * @param {Object} [options.author] - Author object
 * @returns {Object} Discord embed object
 */
export function createEmbed(options) {
    const embed = {};

    if (options.title) embed.title = options.title;
    if (options.description) embed.description = options.description;
    if (options.color !== undefined) embed.color = options.color;
    if (options.fields) embed.fields = options.fields;
    if (options.footer) embed.footer = options.footer;
    if (options.thumbnail) embed.thumbnail = options.thumbnail;
    if (options.image) embed.image = options.image;
    if (options.author) embed.author = options.author;

    // Add timestamp by default
    embed.timestamp = options.timestamp || new Date().toISOString();

    return embed;
}

/**
 * Creates a success embed.
 * @param {string} description - Success message
 * @param {Object} [options={}] - Additional embed options
 * @returns {Object} Success embed
 */
export function successEmbed(description, options = {}) {
    return createEmbed({
        description: `✅ ${description}`,
        color: EmbedColors.SUCCESS,
        ...options,
    });
}

/**
 * Creates an error embed.
 * @param {string} description - Error message
 * @param {Object} [options={}] - Additional embed options
 * @returns {Object} Error embed
 */
export function errorEmbed(description, options = {}) {
    return createEmbed({
        description: `❌ ${description}`,
        color: EmbedColors.ERROR,
        ...options,
    });
}

/**
 * Creates an alert embed.
 * @param {string} title - Alert title
 * @param {string} description - Alert message
 * @param {Object} [options={}] - Additional embed options
 * @returns {Object} Alert embed
 */
export function alertEmbed(title, description, options = {}) {
    return createEmbed({
        title: `🚨 ${title}`,
        description,
        color: EmbedColors.ERROR,
        ...options,
    });
}

/**
 * Webhook service for sending notifications.
 */
export class WebhookService {
    /**
     * Creates a WebhookService instance.
     * @param {string} [webhookUrl] - Discord webhook URL
     */
    constructor(webhookUrl = null) {
        let url = webhookUrl || config.webhookUrl;

        // Normalize webhook URL to use standard discord.com domain
        if (url) {
            url = url.replace('ptb.discord.com', 'discord.com')
                .replace('canary.discord.com', 'discord.com');
        }

        this.webhookUrl = url;
        this.logger = getLogger().child('Webhook');
        this.enabled = !!this.webhookUrl;
    }

    /**
     * Sends embeds via webhook.
     * @param {Object[]} embeds - Array of embed objects
     * @param {Object} [options={}] - Send options
     * @param {string} [options.content] - Message content
     * @param {string} [options.username] - Override username
     * @returns {Promise<boolean>} True if sent successfully
     */
    async send(embeds, options = {}) {
        if (!this.enabled) {
            this.logger.debug('Webhook disabled, skipping send');
            return false;
        }

        // Ensure embeds is a valid array with at least one embed
        const embedArray = Array.isArray(embeds) ? embeds : [embeds];
        const validEmbeds = embedArray.filter(e => e && (e.description || e.title || e.fields));

        if (validEmbeds.length === 0) {
            this.logger.debug('No valid embeds to send');
            return false;
        }

        const payload = {
            embeds: validEmbeds,
            username: options.username || DEFAULT_USERNAME,
        };

        if (options.content) {
            payload.content = options.content;
        }

        try {
            await withRetry(async () => {
                const response = await postJson(this.webhookUrl, payload, {
                    timeout: 10000,
                });

                if (response.statusCode === 429) {
                    const retryAfter = parseInt(response.headers['retry-after'] || '1000', 10);
                    const error = new Error('Rate limited');
                    error.status = 429;
                    error.retryAfter = retryAfter * 1000;
                    throw error;
                }

                if (response.statusCode < 200 || response.statusCode >= 300) {
                    console.log('[DEBUG] Webhook response:', response.statusCode, response.body);
                    const error = new Error(`Webhook failed: ${response.statusCode} - ${response.body}`);
                    throw error;
                }
            }, {
                context: 'sending webhook',
                maxAttempts: 2,
            });

            this.logger.debug('Webhook sent successfully');
            return true;
        } catch (error) {
            this.logger.error('Webhook send failed', error);
            return false;
        }
    }

    /**
     * Sends a success notification.
     * @param {string} message - Success message
     * @returns {Promise<boolean>} True if sent
     */
    async notifySuccess(message) {
        return this.send([successEmbed(message)]);
    }

    /**
     * Sends an error notification.
     * @param {string} message - Error message
     * @returns {Promise<boolean>} True if sent
     */
    async notifyError(message) {
        return this.send([errorEmbed(message)]);
    }

    /**
     * Sends an alert notification.
     * @param {string} title - Alert title
     * @param {string} message - Alert message
     * @returns {Promise<boolean>} True if sent
     */
    async notifyAlert(title, message) {
        return this.send([alertEmbed(title, message)]);
    }

    /**
     * Sends an online notification.
     * @param {string} selfBotTag - Self-bot user tag
     * @param {string} [commandBotTag] - Command bot user tag
     * @returns {Promise<boolean>} True if sent
     */
    async notifyOnline(selfBotTag, commandBotTag = null) {
        if (!selfBotTag) return false;

        let description = `\`${selfBotTag}\` is now online`;
        if (commandBotTag) {
            description = `\`${selfBotTag}\` and \`${commandBotTag}\` are now online`;
        }

        const success = await this.send(createEmbed({
            title: 'Bot Online',
            description,
            color: EmbedColors.BLURPLE,
            footer: {},
        }), { username: "auth" });

        if (success) {
            this.logger.plain('Online notification sent');
        }

        return success;
    }

    /**
     * Sends an update available notification.
     * @param {string} currentVersion - Current version
     * @param {string} newVersion - New version available
     * @returns {Promise<boolean>} True if sent
     */
    async notifyUpdate(currentVersion, newVersion) {
        return this.send(createEmbed({
            title: 'Update Available',
            description: `A new version of the automation suite is available!`,
            color: EmbedColors.WARNING,
            fields: [
                { name: 'Current Version', value: `\`${currentVersion}\``, inline: true },
                { name: 'New Version', value: `\`${newVersion}\``, inline: true },
                { name: 'Update Action', value: 'Run `git pull` in your terminal to update.', inline: false }
            ]
        }), { username: "System Updater" });
    }

    /**
     * Sends a status notification.
     * @param {string} title - message title
     * @param {string} message - Status message
     * @param {string} [color] - Embed color (default: INFO)
     * @returns {Promise<boolean>} True if sent
     */
    async notifyStatus(title, message, color = EmbedColors.INFO) {
        return this.send(createEmbed({
            title: title,
            description: message,
            color: color,
        }), { username: "System Updater" });
    }
}

// Singleton instance
let webhookServiceInstance = null;

/**
 * Gets or creates the webhook service instance.
 * @returns {WebhookService} Webhook service instance
 */
export function getWebhookService() {
    if (!webhookServiceInstance) {
        webhookServiceInstance = new WebhookService();
    }
    return webhookServiceInstance;
}

export default {
    WebhookService,
    getWebhookService,
    createEmbed,
    successEmbed,
    errorEmbed,
    alertEmbed,
    EmbedColors,
};