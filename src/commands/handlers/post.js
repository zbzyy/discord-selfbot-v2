/**
 * @fileoverview Handler for the /post command.
 * Posts changelogs/updates to a specific channel.
 * @module commands/handlers/post
 */

import { getDiscordService } from '../../services/discord.js';
import { createEmbed, EmbedColors } from '../../services/webhook.js';

/**
 * The channel ID to post updates to.
 * @type {string}
 */
const UPDATE_CHANNEL_ID = '1436716014330052731';

/**
 * Handles the /post command.
 * @param {Interaction} interaction - Discord interaction
 * @returns {Promise<void>}
 */
export async function handlePost(interaction) {
    const discord = getDiscordService();

    // Get options
    let title = interaction.options.getString('title');
    let content = interaction.options.getString('content');
    let version = interaction.options.getString('version');
    const imageUrl = interaction.options.getString('image');

    // If options are missing, try to read from CHANGELOG.md
    if (!title || !content) {
        try {
            const fs = await import('fs/promises');
            const data = await fs.readFile('./CHANGELOG.md', 'utf-8');

            const lines = data.split('\n');
            const titleLine = lines.find(l => l.startsWith('# '));
            const versionLine = lines.find(l => l.startsWith('## '));

            if (!title && titleLine) title = titleLine.replace('# ', '').trim();
            if (!version && versionLine) version = versionLine.replace('## ', '').trim();

            // Content is everything else, minus the used headers
            if (!content) {
                content = lines
                    .filter(l => l !== titleLine && l !== versionLine)
                    .join('\n')
                    .trim();
            }

            if (!title || !content) {
                throw new Error('CHANGELOG.md is invalid or empty. Needs # Title and content.');
            }
        } catch (error) {
            if ((!title || !content) && error.code === 'ENOENT') {
                await interaction.editReply({
                    content: `**Error:** No arguments provided and \`CHANGELOG.md\` not found.`,
                    ephemeral: true
                });
                return;
            }
        }
    }

    // Create the embed
    const embed = createEmbed({
        title: title || 'New Update',
        description: content || 'No content provided.',
        color: EmbedColors.INFO,
        footer: version ? { text: `Prism Bot • ${version}` } : undefined,
    });

    if (imageUrl) {
        embed.image = { url: imageUrl };
    }

    try {
        // Fetch the target channel
        const client = discord.getCommandClient();
        const channel = await client.channels.fetch(UPDATE_CHANNEL_ID);

        if (!channel) {
            throw new Error('Update channel not found or not accessible.');
        }

        if (!channel.isTextBased()) {
            throw new Error('Target channel is not a text channel.');
        }

        // Send the message
        await channel.send({ embeds: [embed] });

        // Confirm to user
        await interaction.editReply({
            content: `update posted to <#${UPDATE_CHANNEL_ID}>`,
            ephemeral: true
        });

    } catch (error) {
        console.error('Failed to post update:', error);
        await interaction.editReply({
            content: `❌ **Failed to post update:** ${error.message}`,
            ephemeral: true
        });
    }
}

export default handlePost;
