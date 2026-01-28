/**
 * @fileoverview Message event handlers.
 * Handles keyword monitoring, message deletion tracking, and edit logging.
 * @module events/message
 */

import { config } from '../config/index.js';
import { getLogger } from '../logger/index.js';
import { getWebhookService, alertEmbed, createEmbed, EmbedColors } from '../services/webhook.js';

/**
 * Creates message event handlers for the self-bot client.
 * @param {Client} selfBotClient - Self-bot client instance
 * @returns {Object} Event handler functions
 */
export function createMessageEventHandlers(selfBotClient) {
    const logger = getLogger().child('Messages');
    const webhook = getWebhookService();

    /**
     * Handles new messages for keyword monitoring.
     * @param {Message} message - Discord message
     */
    async function handleMessageCreate(message) {
        // Ignore own messages
        if (message.author.id === selfBotClient.user?.id) return;

        const content = message.content.toLowerCase();
        const hit = config.watchKeywords.find(k => content.includes(k.toLowerCase()));

        if (hit) {
            const context = message.guild
                ? `Server: ${message.guild.name} (#${message.channel.name})`
                : 'DM';

            const alertMessage = `[KEYWORD HIT: "${hit}"] | ${context} | User: ${message.author.tag}`;

            logger.alert('ALERT', alertMessage);

            // Log to file
            await logger.toFile('keyword_hits.txt',
                `${alertMessage}\nContent: ${message.content}\n---`
            );

            // Send webhook notification
            await webhook.send([alertEmbed(
                'Keyword Alert',
                `**Keyword:** \`${hit}\`\n` +
                `**User:** ${message.author.tag}\n` +
                `**Context:** ${context}\n` +
                `\`\`\`\n${message.content.substring(0, 1000)}\n\`\`\``
            )]);
        }
    }

    /**
     * Handles message deletions for snipe logging.
     * @param {Message} message - Deleted message
     */
    async function handleMessageDelete(message) {
        const authorTag = message.author?.tag || 'Unknown User';
        const channelName = message.channel?.name || 'unknown';
        const context = message.guild ? `#${channelName}` : 'DM';

        const content = message.content || '';
        const attachment = message.attachments?.first();
        const imageUrl = attachment && attachment.contentType?.startsWith('image/') ? attachment.url : null;

        // Skip if no content and no attachments (likely uncached)
        if (!content && !attachment) return;

        // Skip if deleted by self
        if (message.author.id === selfBotClient.user?.id) return;

        const logMessage = `${authorTag} deleted a message in ${context} - ${message.content} ${attachment ? `[attachment: ${attachment.url}]` : ''}`;
        logger.plain(logMessage);

        const embedData = {
            description: `Message deleted by \`${authorTag}\` in \`${context}\``,
            color: EmbedColors.ERROR,
            footer: { text: `${message.author?.id || 'Unknown'}` },
        };

        if (content) {
            embedData.description += `\n\`\`\`\n${content.substring(0, 1000)}\n\`\`\``;
        }

        if (imageUrl) {
            embedData.image = { url: imageUrl };
        } else if (attachment) {
            embedData.description += `\n**Attachment:** [${attachment.name}](${attachment.url})`;
        }

        await webhook.send([createEmbed(embedData)], { username: 'logger' });
    }

    /**
     * Handles message edits for edit logging.
     * @param {Message} oldMessage - Original message
     * @param {Message} newMessage - Edited message
     */
    async function handleMessageUpdate(oldMessage, newMessage) {
        // Check if edit logging is enabled
        if (!config.logEdited) return;

        if (!oldMessage.author) return;
        if (oldMessage.content === newMessage.content) return;
        if (!oldMessage.content) return;

        if (oldMessage.author.id === selfBotClient.user?.id) return;

        const context = oldMessage.guild?.name || 'DM';

        logger.plain(`Message edited by ${oldMessage.author.tag} in ${context} - ${oldMessage.content} -> ${newMessage.content}`);

        const embedData = {
            description: `Message edited by \`${oldMessage.author.tag}\` in \`${context}\` - [here](${oldMessage.url})`,
            color: EmbedColors.WARNING,
            footer: { text: `${oldMessage.author?.id || 'Unknown'}` },
        };

        if (oldMessage.content) {
            embedData.description += `\n\`\`\`\n${oldMessage.content.substring(0, 1000)}\n\`\`\``;
        }

        if (newMessage.content) {
            embedData.description += `\n\`\`\`\n${newMessage.content.substring(0, 1000)}\n\`\`\``;
        }

        await webhook.send([createEmbed(embedData)], { username: 'logger' });
    }

    return {
        handleMessageCreate,
        handleMessageDelete,
        handleMessageUpdate,
    };
}

export default { createMessageEventHandlers };