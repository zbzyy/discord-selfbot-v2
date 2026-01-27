/**
 * @fileoverview Command registry for managing and executing slash commands.
 * Replaces switch statements with a plugin-style architecture.
 * @module commands/registry
 */

import { getLogger } from '../logger/index.js';
import { isAuthorized, withErrorHandler, withDefer } from './decorators.js';

/**
 * Command registry for managing slash command handlers.
 */
export class CommandRegistry {
    /**
     * Creates a CommandRegistry instance.
     */
    constructor() {
        this.commands = new Map();
        this.logger = getLogger().child('CommandRegistry');
    }

    /**
     * Registers a command handler.
     * @param {string} name - Command name
     * @param {Function} handler - Async handler function
     * @param {Object} [options={}] - Registration options
     * @param {boolean} [options.requiresAuth=true] - Require owner authorization
     * @param {boolean} [options.defer=true] - Auto-defer the interaction
     */
    register(name, handler, options = {}) {
        const opts = {
            requiresAuth: true,
            defer: true,
            ...options,
        };

        this.commands.set(name, {
            handler,
            options: opts,
        });

        this.logger.debug(`Registered command: ${name}`);
    }

    /**
     * Checks if a command is registered.
     * @param {string} name - Command name
     * @returns {boolean} True if registered
     */
    has(name) {
        return this.commands.has(name);
    }

    /**
     * Gets the number of registered commands.
     * @returns {number} Command count
     */
    get size() {
        return this.commands.size;
    }

    /**
     * Executes a command by name.
     * @param {string} name - Command name
     * @param {Interaction} interaction - Discord interaction
     * @returns {Promise<void>}
     */
    async execute(name, interaction) {
        const command = this.commands.get(name);

        if (!command) {
            this.logger.warn(`Unknown command attempted: ${name}`);
            await interaction.reply({
                content: `Unknown command: ${name}`,
                flags: 64,
            });
            return;
        }

        const { handler, options } = command;

        // Check authorization
        if (options.requiresAuth && !isAuthorized(interaction.user.id)) {
            await interaction.reply({
                content: 'Authorization failed. This command is restricted.',
                flags: 64,
            });
            return;
        }

        this.logger.plain(`Executing command: /${name} by ${interaction.user.tag}`);

        // Defer if needed
        if (options.defer) {
            await interaction.deferReply({ flags: 64 });
        }

        // Execute with error handling
        try {
            await handler(interaction);
        } catch (error) {
            this.logger.error(`Command error: /${name}`, error);

            const errorMessage = `Command failed - Error: ${error.message}`;

            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ content: errorMessage });
                } else {
                    await interaction.reply({ content: errorMessage, flags: 64 });
                }
            } catch {
                // Ignore reply errors
            }
        }
    }

    /**
     * Gets a list of registered command names.
     * @returns {string[]} Array of command names
     */
    getCommandNames() {
        return Array.from(this.commands.keys());
    }
}

// Singleton instance
let registryInstance = null;

/**
 * Gets or creates the command registry instance.
 * @returns {CommandRegistry} Command registry instance
 */
export function getCommandRegistry() {
    if (!registryInstance) {
        registryInstance = new CommandRegistry();
    }
    return registryInstance;
}

export default { CommandRegistry, getCommandRegistry };