/**
 * @fileoverview Nuke server command handler.
 * Deletes an entire server.
 * 
 * @warning This is an EXTREMELY DESTRUCTIVE operation that cannot be undone.
 * @warning This violates Discord's Terms of Service.
 * @module commands/handlers/nuke-server
 */

import { getDiscordService } from '../../services/discord.js';
import { getLogger } from '../../logger/index.js';

/**
 * Handles the /nuke_server command.
 * 
 * @warning EXTREMELY DESTRUCTIVE: Deletes the entire server permanently.
 * @param {Interaction} interaction - Discord interaction
 * @returns {Promise<void>}
 */
export async function handleNukeServer(interaction) {
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

    const guildName = guild.name;
    logger.warn(`Starting FULL SERVER NUKE: ${guildName} (${guildId})`);

    try {
        await discord.deleteGuild(guild);

        logger.success(`Server deleted: ${guildName}`);

        await interaction.editReply({
            content: `🔴 **SERVER DELETED.**\n` +
                `💀 Server **${guildName}** has been wiped from existence.`,
        });
    } catch (error) {
        logger.error(`Failed to delete server: ${guildName}`, error);

        await interaction.editReply({
            content: `❌ **DELETION FAILED:** ${error.message}`,
        });
    }
}

export default handleNukeServer;