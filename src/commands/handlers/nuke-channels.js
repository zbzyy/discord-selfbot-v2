/**
 * @fileoverview Nuke channels command handler.
 * Deletes all channels in an owned server.
 * 
 * @warning This is an EXTREMELY DESTRUCTIVE operation that cannot be undone.
 * @warning This violates Discord's Terms of Service.
 * @module commands/handlers/nuke-channels
 */

import { getDiscordService } from '../../services/discord.js';
import { getLogger } from '../../logger/index.js';

/**
 * Handles the /nuke_channels command.
 * 
 * @warning EXTREMELY DESTRUCTIVE: Deletes all channels in a server permanently.
 * @param {Interaction} interaction - Discord interaction
 * @returns {Promise<void>}
 */
export async function handleNukeChannels(interaction) {
    const logger = getLogger();
    const discord = getDiscordService();

    const guildId = interaction.options.getString('guild_id');

    // Validate guild ID
    discord.validateId(guildId, 'Guild ID');

    // Get guild from cache
    const guild = discord.getCachedGuild(guildId);

    if (!guild) {
        await interaction.editReply({
            content: `❌ Server with ID \`${guildId}\` not found in cache. Did you join it?`,
        });
        return;
    }

    // Verify ownership
    const selfUserId = discord.getSelfUserId();
    if (guild.ownerId !== selfUserId) {
        await interaction.editReply({
            content: `🚫 Server **${guild.name}** is not owned by your self-bot account. Aborting.`,
        });
        return;
    }

    logger.warn(`Starting channel nuke on server: ${guild.name} (${guildId})`);

    const channels = Array.from(guild.channels.cache.values());
    let deleteCount = 0;
    let errorCount = 0;

    for (const channel of channels) {
        try {
            await discord.deleteChannel(channel);
            deleteCount++;
            logger.progress(`Deleted ${deleteCount}/${channels.length} channels...`);
        } catch (error) {
            errorCount++;
            logger.error(`Failed to delete channel ${channel.name}`, error);
        }
    }

    logger.progressEnd();
    logger.success(`Channel nuke complete: ${deleteCount} channels deleted`);

    await interaction.editReply({
        content: `✅ **Structure Nuke Complete.**\n` +
            `💥 **Channels deleted:** ${deleteCount}\n` +
            `${errorCount > 0 ? `❌ **Errors:** ${errorCount}\n` : ''}` +
            `🏠 **Server:** ${guild.name}`,
    });
}

export default handleNukeChannels;