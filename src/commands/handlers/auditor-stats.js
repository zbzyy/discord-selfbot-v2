/**
 * @fileoverview Activity auditor command handler.
 * Analyzes chat activity patterns across DMs.
 * @module commands/handlers/auditor-stats
 */

import dayjs from 'dayjs';
import { getDiscordService } from '../../services/discord.js';
import { config } from '../../config/index.js';
import { getLogger } from '../../logger/index.js';
import { EmbedColors } from '../../services/webhook.js';

/** Channel type constants (discord.js-selfbot-v13 uses numeric types) */
const CHANNEL_TYPE_DM = 1;
const CHANNEL_TYPE_GROUP_DM = 3;

/** Day names for display */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Handles the /auditor_stats command.
 * @param {Interaction} interaction - Discord interaction
 * @returns {Promise<void>}
 */
export async function handleAuditorStats(interaction) {
    const logger = getLogger();
    const discord = getDiscordService();

    const messagesToAnalyze = config.maxScrapeLimit;

    // Data structures for analysis
    const messageCounts = new Map();
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);

    // Get DM channels
    const dmChannels = discord.getDMChannels(CHANNEL_TYPE_DM, CHANNEL_TYPE_GROUP_DM);

    logger.info(`Analyzing activity across ${dmChannels.length} DM channels`);

    let totalMessagesChecked = 0;
    const selfUserId = discord.getSelfUserId();

    // Analyze each channel
    for (const channel of dmChannels) {
        const recipient = channel.recipient?.tag || channel.name || 'Group Chat';
        const recipientId = channel.recipient?.id;

        const messages = await discord.fetchMessages(channel, messagesToAnalyze, {
            onProgress: (fetched, total) => {
                logger.progress(`Analyzing: ${recipient} (${fetched} messages)...`);
            },
        });

        totalMessagesChecked += messages.length;

        for (const msg of messages) {
            // Skip own messages
            if (msg.author.id === selfUserId) continue;

            // Count messages by partner
            if (recipientId) {
                messageCounts.set(recipient, (messageCounts.get(recipient) || 0) + 1);
            }

            // Time analysis
            const date = dayjs(msg.createdTimestamp);
            hourCounts[date.hour()]++;
            dayCounts[date.day()]++;
        }
    }

    // Sort and get top 5 partners
    const sortedPartners = Array.from(messageCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const partnerList = sortedPartners
        .map(([tag, count], index) => `${index + 1}. **${tag}**: ${count} messages`)
        .join('\n') || 'No data available';

    // Find most active times
    const mostActiveHour = hourCounts.indexOf(Math.max(...hourCounts));
    const mostActiveDayIndex = dayCounts.indexOf(Math.max(...dayCounts));

    const embed = {
        color: EmbedColors.BLURPLE,
        title: '📊 Activity Report',
        description: `*Analyzed ${totalMessagesChecked.toLocaleString()} messages across ${dmChannels.length} DM channels.*`,
        fields: [
            {
                name: 'Top 5 Chat Partners',
                value: partnerList,
                inline: false,
            },
            {
                name: 'Most Active Hour',
                value: `${mostActiveHour}:00 - ${mostActiveHour + 1}:00`,
                inline: true,
            },
            {
                name: 'Most Active Day',
                value: DAY_NAMES[mostActiveDayIndex],
                inline: true,
            },
        ],
        timestamp: new Date().toISOString(),
    };

    logger.success(`Activity analysis complete: ${totalMessagesChecked} messages analyzed`);

    await interaction.editReply({ embeds: [embed] });
}

export default handleAuditorStats;