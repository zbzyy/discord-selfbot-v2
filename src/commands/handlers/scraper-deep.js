/**
 * @fileoverview Deep scraper command handler.
 * Backs up channel messages to JSON files by default with the option for text file exports.
 * @module commands/handlers/scraper-deep
 */

import path from 'path';
import dayjs from 'dayjs';
import { getDiscordService } from '../../services/discord.js';
import { safeWriteFile } from '../../utils/file.js';
import { config } from '../../config/index.js';
import { getLogger } from '../../logger/index.js';

/**
 * Handles the /scraper_deep command.
 * @param {Interaction} interaction - Discord interaction
 * @returns {Promise<void>}
 */
export async function handleScraperDeep(interaction) {
    const logger = getLogger();
    const discord = getDiscordService();

    const channelId = interaction.options.getString('channel_id');
    let limit = interaction.options.getInteger('limit');

    // 0 means unlimited
    if (limit === 0) {
        limit = Infinity;
    }

    discord.validateId(channelId, 'Channel ID');
    const channel = await discord.fetchChannel(channelId);

    if (!channel) {
        throw new Error('Channel not found or inaccessible.');
    }

    // Check if it's a voice channel
    if (channel.type === 2 || channel.type === 'GUILD_VOICE') {
        throw new Error('Cannot scrape voice channels.');
    }

    const logLimit = limit === Infinity ? '0 (all)' : limit;
    logger.info(`Starting deep scrape of ${channel.name || channelId}, limit: ${logLimit}`);

    // Fetch messages with progress updates
    const allMessages = await discord.fetchMessages(channel, limit, {
        onProgress: (fetched, total) => {
            logger.progress(`Fetched ${fetched}/${total} messages...`);
        },
    });

    // Format messages for JSON output
    const jsonOutput = allMessages.map(m => ({
        id: m.id,
        timestamp: dayjs(m.createdTimestamp).format('YYYY-MM-DD HH:mm:ss'),
        author: m.author.tag,
        authorId: m.author.id,
        content: m.content,
        attachments: Array.from(m.attachments.values()).map(a => a.url),
        hasEmbeds: m.embeds.length > 0,
    }));

    // Generate filename and save
    const channelName = channel.name || channelId;
    const safeChannelName = channelName.replace(/[^a-z0-9]/gi, '_').substring(0, 50);

    // Create export directory: exports/{name}_{id}
    const exportDirName = `${safeChannelName}_${channel.id}`;
    const targetDir = path.join(config.exportDir, exportDirName);

    const format = interaction.options.getString('format') || 'json';
    const timestampStr = dayjs().format('YYYYMMDD_HHmmss');

    if (format === 'txt') {
        const fileName = `scrape_${timestampStr}.txt`;
        const filePath = path.join(targetDir, fileName);

        const txtContent = allMessages.map(m => {
            const time = dayjs(m.createdTimestamp).format('YYYY-MM-DD HH:mm:ss');
            const attachments = m.attachments.size > 0 ? ` [Attachments: ${Array.from(m.attachments.values()).map(a => a.url).join(', ')}]` : '';
            return `[${time}] ${m.author.tag}: ${m.content}${attachments}`;
        }).join('\n');

        await safeWriteFile(filePath, txtContent);
        logger.success(`Scrape complete: ${allMessages.length} messages saved to ${filePath}`);
    } else {
        const fileName = `scrape_${timestampStr}.json`;
        const filePath = path.join(targetDir, fileName);
        await safeWriteFile(filePath, JSON.stringify(jsonOutput, null, 2));
        logger.success(`Scrape complete: ${allMessages.length} messages saved to ${filePath}`);
    }

    await interaction.editReply({
        content:
            `Scrape complete\n` +
            `\`${allMessages.length}\` messages archived\n` +
            `Saved to \`${filePath}\``,
    });
}

export default handleScraperDeep;