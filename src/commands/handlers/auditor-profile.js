/**
 * @fileoverview User profiler command handler.
 * Gets detailed information about a Discord user.
 * @module commands/handlers/auditor-profile
 */

import dayjs from 'dayjs';
import { getDiscordService } from '../../services/discord.js';
import { getLogger } from '../../logger/index.js';
import { EmbedColors } from '../../services/webhook.js';

/**
 * Maps premium type to display string.
 * @param {number|string} premiumType - Discord premium type
 * @returns {string} Display string
 */
function getNitroStatus(premiumType) {
    const types = {
        'NITRO_CLASSIC': 'Classic Nitro',
        'NITRO_BASIC': 'Nitro Basic',
        'NITRO': 'Nitro',
        1: 'Nitro Classic',
        2: 'Nitro',
        3: 'Nitro Basic',
    };
    return types[premiumType] || 'None';
}

/**
 * Handles the /auditor_profile command.
 * @param {Interaction} interaction - Discord interaction
 * @returns {Promise<void>}
 */
export async function handleAuditorProfile(interaction) {
    const logger = getLogger();
    const discord = getDiscordService();

    const userId = interaction.options.getString('user_id');

    // Validate and fetch user (use command bot for reliable lookup)
    discord.validateId(userId, 'User ID');
    const user = await discord.fetchUser(userId, true);

    if (!user) {
        throw new Error('User not found or inaccessible.');
    }

    logger.info(`Profiling user: ${user.tag}`);

    // Calculate account age
    const created = dayjs(user.createdAt);
    const age = dayjs().diff(created, 'day');

    // Get avatar and banner URLs
    const avatarUrl = user.displayAvatarURL({ dynamic: true, size: 1024 });
    const bannerUrl = user.bannerURL?.({ dynamic: true, size: 1024 });

    const profileEmbed = {
        color: EmbedColors.BLURPLE,
        title: `User Profile: ${user.tag}`,
        thumbnail: { url: avatarUrl },
        description: `**User ID:** \`${user.id}\``,
        fields: [
            { name: 'Tag', value: user.tag, inline: true },
            { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true },
            { name: 'Nitro Status', value: getNitroStatus(user.premiumType), inline: true },

            { name: 'Creation Date', value: created.format('MMM D, YYYY'), inline: true },
            { name: 'Account Age', value: `${age.toLocaleString()} days`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true }, // Spacer

            { name: 'Avatar Link', value: `[View Avatar](${avatarUrl})`, inline: true },
            { name: 'Banner Link', value: bannerUrl ? `[View Banner](${bannerUrl})` : 'None', inline: true },
        ],
        timestamp: new Date().toISOString(),
    };

    await interaction.editReply({ embeds: [profileEmbed] });
}

export default handleAuditorProfile;