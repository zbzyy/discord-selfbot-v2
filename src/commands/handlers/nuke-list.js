/**
 * @fileoverview Nuke list command handler.
 * Lists all servers owned by the self-bot account.
 * @module commands/handlers/nuke-list
 */

import { getDiscordService } from '../../services/discord.js';
import { getLogger } from '../../logger/index.js';

/**
 * Handles the /nuke_list command.
 * @param {Interaction} interaction - Discord interaction
 * @returns {Promise<void>}
 */
export async function handleNukeList(interaction) {
    const logger = getLogger();
    const discord = getDiscordService();

    const ownedGuilds = discord.getOwnedGuilds();

    if (ownedGuilds.length === 0) {
        await interaction.editReply({
            content: '🚫 You do not appear to own any servers on this account.',
        });
        return;
    }

    logger.info(`Found ${ownedGuilds.length} owned servers`);

    const list = ownedGuilds
        .map(g => `• **${g.name}** (\`${g.id}\`)`)
        .join('\n');

    await interaction.editReply({
        content: `🚨 **Owned Servers Ready for Nuke Targeting**\n\n${list}\n\n` +
            `*Use the Guild ID with the \`/nuke_channels\` or \`/nuke_server\` commands.*`,
    });
}

export default handleNukeList;