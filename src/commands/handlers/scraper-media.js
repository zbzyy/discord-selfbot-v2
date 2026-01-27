/**
 * @fileoverview Media archiver command handler.
 * Downloads all media attachments from a DM conversation.
 * @module commands/handlers/scraper-media
 */

import path from 'path';
import { getDiscordService } from '../../services/discord.js';
import { downloadFile } from '../../services/http.js';
import { ensureDir, fileExists, sanitizeFilename } from '../../utils/file.js';
import { config } from '../../config/index.js';
import { getLogger } from '../../logger/index.js';

/**
 * Handles the /scraper_media command.
 * @param {Interaction} interaction - Discord interaction
 * @returns {Promise<void>}
 */
export async function handleScraperMedia(interaction) {
    const logger = getLogger();
    const discord = getDiscordService();

    const userId = interaction.options.getString('user_id');
    let limit = interaction.options.getInteger('limit');

    // 0 means unlimited
    if (limit === 0) {
        limit = Infinity;
    }

    // Validate and fetch user
    discord.validateId(userId, 'User ID');
    const user = await discord.fetchUserSelf(userId);

    if (!user) {
        throw new Error('User not found or inaccessible.');
    }

    // Create DM channel
    const dmChannel = await user.createDM();

    // Create target directory with sanitized username
    // Create target directory with sanitized username
    const safeUsername = sanitizeFilename(user.username);
    const exportDirName = `${safeUsername}_${user.id}`;
    const targetDir = path.join(config.exportDir, exportDirName);
    await ensureDir(targetDir);

    const logLimit = limit === Infinity ? '0 (all)' : limit;
    logger.info(`Starting media archive from ${user.tag}, limit: ${logLimit}`);

    // Fetch messages
    const allMessages = await discord.fetchMessages(dmChannel, limit, {
        onProgress: (fetched, total) => {
            logger.progress(`Scanning ${fetched}/${total} messages...`);
        },
    });

    // Sort messages (Oldest to Newest)
    allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    // Save messages to JSON
    const jsonOutput = allMessages.map(m => ({
        id: m.id,
        timestamp: m.createdAt.toISOString().replace('T', ' ').substring(0, 19),
        author: m.author.tag,
        authorId: m.author.id,
        content: m.content,
        attachments: Array.from(m.attachments.values()).map(a => a.url),
    }));

    // Save messages based on format
    const format = interaction.options.getString('format') || 'json';

    if (format === 'txt') {
        const messagesPath = path.join(targetDir, 'messages.txt');
        const txtContent = allMessages.map(m => {
            const time = m.createdAt.toISOString().replace('T', ' ').substring(0, 19);
            const attachments = m.attachments.size > 0 ? ` [Attachments: ${Array.from(m.attachments.values()).map(a => a.url).join(', ')}]` : '';
            return `[${time}] ${m.author.tag}: ${m.content}${attachments}`;
        }).join('\n');

        await import('../../utils/file.js').then(m => m.safeWriteFile(messagesPath, txtContent));
    } else {
        const messagesPath = path.join(targetDir, 'messages.json');
        await import('../../utils/file.js').then(m => m.safeWriteFile(messagesPath, JSON.stringify(jsonOutput, null, 2)));
    }

    // Prepare media directory
    const mediaDir = path.join(targetDir, 'media');
    await ensureDir(mediaDir);

    // Process attachments
    let downloadCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const msg of allMessages) {
        if (msg.attachments.size === 0) continue;

        for (const attachment of msg.attachments.values()) {
            const safeFilename = sanitizeFilename(attachment.name || 'file');
            const filename = `${msg.id}_${safeFilename}`;
            // Save to media subdirectory
            const filePath = path.join(mediaDir, filename);

            // Skip if file exists
            if (await fileExists(filePath)) {
                skipCount++;
                continue;
            }

            try {
                await downloadFile(attachment.url, filePath, {
                    timeout: 60000, // 60 second timeout for large files
                });
                downloadCount++;
                logger.debug(`Downloaded: ${filename}`);
            } catch (error) {
                errorCount++;
                logger.error(`Failed to download ${attachment.url}`, error);
            }
        }
    }

    logger.success(`Media archive complete: ${downloadCount} downloaded, ${skipCount} skipped, ${errorCount} errors`);

    await interaction.editReply({
        content:
            `Archive complete\n` +
            `\`${allMessages.length}\` messages archived · ` +
            `\`${downloadCount}\` downloaded · ` +
            `\`${skipCount}\` skipped\n` +
            `Saved to \`${targetDir}\``,
    });
}

export default handleScraperMedia;