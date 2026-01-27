/**
 * @fileoverview Help command handler with interactive category buttons.
 * Displays commands with category selection buttons.
 * @module commands/handlers/help
 */
import { COMMAND_CATEGORIES } from '../definitions.js';
import { EmbedColors } from '../../services/webhook.js';

const EMOJI_MAP = {
    '📥 scraping & archiving': '📥',
    '📊 analytics & auditing': '📊',
    '🧹 cleanup tools': '🧹',
    '💣 server management': '💣',
};

/**
 * Creates the main help embed with category overview.
 * @returns {Object} Discord embed object
 */
function createMainHelpEmbed() {
    let description = '**Available Commands**\n\n';
    for (const [category, commands] of Object.entries(COMMAND_CATEGORIES)) {
        description += `**${category}** (${commands.length})\n`;
    }

    return {
        color: EmbedColors.BLURPLE,
        description: description.trim(),
        timestamp: new Date().toISOString(),
    };
}

/**
 * Creates an embed for a specific command category.
 * @param {string} category - The category name
 * @param {Array} commands - Array of command objects
 * @returns {Object} Discord embed object
 */
function createCategoryEmbed(category, commands) {
    let description = '';
    for (const cmd of commands) {
        description += `**\`${cmd.name}\`** - ${cmd.description}\n`;
        if (cmd.usage) {
            description += `*Usage:* \`${cmd.usage}\`\n`;
        }
        if (cmd.examples?.length) {
            description += `*Examples:* ${cmd.examples.map(e => `\`${e}\``).join(', ')}\n`;
        }
    }

    return {
        color: EmbedColors.BLURPLE,
        title: `${category}`,
        description: description.trim(),
        timestamp: new Date().toISOString(),
    };
}

/**
 * Creates action row buttons for each category.
 * @param {string|null} activeCategory - The currently active category
 * @returns {Array} Array of action row objects with buttons
 */
function createCategoryButtons(activeCategory = null) {
    const rows = [];
    let currentRow = [];

    for (const category of Object.keys(COMMAND_CATEGORIES)) {
        const isActive = category === activeCategory;
        currentRow.push({
            type: 2,
            label: '\u200B', // zero-width space (prevents file icon)
            emoji: { name: EMOJI_MAP[category.toLowerCase()] || '📋' },
            custom_id: `help_category_${category.toLowerCase().replace(/\s+/g, '_')}`,
            style: 1,
            disabled: isActive,
        });

        if (currentRow.length === 5) {
            rows.push({ type: 1, components: currentRow });
            currentRow = [];
        }
    }

    if (currentRow.length) {
        rows.push({ type: 1, components: currentRow });
    }

    if (activeCategory) {
        rows.push({
            type: 1,
            components: [{
                type: 2,
                label: 'Back to Menu',
                custom_id: 'help_back_to_menu',
                style: 2,
            }],
        });
    }

    return rows;
}

/**
 * Handles the /help command.
 * @param {Interaction} interaction - Discord interaction
 * @returns {Promise<void>}
 */
export async function handleHelp(interaction) {
    const mainEmbed = createMainHelpEmbed();
    await interaction.editReply({
        embeds: [mainEmbed],
        components: createCategoryButtons(),
    });

    // Set up button interaction handler
    const collector = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 5 * 60 * 1000, // 5 minute timeout
    });

    collector.on('collect', async (i) => {
        if (i.customId === 'help_back_to_menu') {
            await i.update({
                embeds: [mainEmbed],
                components: createCategoryButtons(),
            });
            return;
        }

        if (!i.customId.startsWith('help_category_')) return;

        const category = i.customId
            .replace('help_category_', '')
            .split('_')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');

        const commands = COMMAND_CATEGORIES[category];
        if (!commands) return;

        await i.update({
            embeds: [createCategoryEmbed(category, commands)],
            components: createCategoryButtons(category),
        });
    });

    collector.on('end', async () => {
        const disabled = createCategoryButtons('__disabled__').map(row => ({
            type: 1,
            components: row.components.map(btn => ({ ...btn, disabled: true })),
        }));

        await interaction.editReply({ components: disabled }).catch(() => { });
    });
}

export default handleHelp;