/**
 * @fileoverview Bulk cleaner command handler.
 * Closes all DMs and rejects all pending friend requests.
 * 
 * @warning This is a destructive operation that cannot be undone.
 * @module commands/handlers/cleaner-bulk
 */

import { getDiscordService } from '../../services/discord.js';
import { getLogger } from '../../logger/index.js';

/** Channel type constants */
const CHANNEL_TYPE_DM = 'DM';
const CHANNEL_TYPE_GROUP_DM = 'GROUP_DM';

/**
 * Handles the /cleaner_bulk command.
 * 
 * @warning DESTRUCTIVE: Closes DMs and rejects friend requests permanently.
 * @param {Interaction} interaction - Discord interaction
 * @returns {Promise<void>}
 */
export async function handleCleanerBulk(interaction) {
    const logger = getLogger();
    const discord = getDiscordService();

    // Send initial warning
    await interaction.followUp({
        content: `⚠️ **Starting Bulk Account Hygiene**\nClosing all DMs and rejecting all friend requests. This is **irreversible**.`,
        flags: 64,
    });

    logger.warn('Starting bulk cleanup operation');

    // Close all DM channels
    const dmChannels = discord.getDMChannels(CHANNEL_TYPE_DM, CHANNEL_TYPE_GROUP_DM);
    let dmCount = 0;
    let dmErrors = 0;

    logger.info(`Found ${dmChannels.length} DM channels to close`);

    for (const channel of dmChannels) {
        try {
            await discord.deleteChannel(channel);
            dmCount++;
            logger.progress(`Closed ${dmCount}/${dmChannels.length} DMs...`);
        } catch (error) {
            dmErrors++;
            logger.error(`Failed to close DM ${channel.id}`, error);
        }
    }

    logger.progressEnd();
    await interaction.followUp({
        content: `✅ Closed ${dmCount} DM channels${dmErrors > 0 ? ` (${dmErrors} errors)` : ''}.`,
        flags: 64,
    });

    // Reject all friend requests
    const requests = discord.getIncomingFriendRequests();
    let reqCount = 0;
    let reqErrors = 0;

    logger.info(`Found ${requests.length} pending friend requests`);

    for (const user of requests) {
        try {
            await discord.rejectFriendRequest(user);
            reqCount++;
            logger.progress(`Rejected ${reqCount}/${requests.length} requests...`);
        } catch (error) {
            reqErrors++;
            logger.error(`Failed to reject request from ${user.tag}`, error);
        }
    }

    logger.progressEnd();

    await interaction.followUp({
        content: `✅ Rejected ${reqCount} friend requests${reqErrors > 0 ? ` (${reqErrors} errors)` : ''}.`,
        flags: 64,
    });

    logger.success(`Bulk cleanup complete: ${dmCount} DMs closed, ${reqCount} requests rejected`);

    await interaction.editReply({
        content: `✅ **Bulk Hygiene Complete.**\n` +
            `📭 **DMs closed:** ${dmCount}\n` +
            `🚫 **Requests rejected:** ${reqCount}`,
    });
}

export default handleCleanerBulk;