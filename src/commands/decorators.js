/**
 * @fileoverview Command decorators for authorization, error handling, and rate limiting.
 * Provides reusable wrappers for command handlers.
 * @module commands/decorators
 */

import { config } from '../config/index.js';
import { getLogger } from '../logger/index.js';
import { AuthorizationError } from '../errors/index.js';

/**
 * Checks if a user is authorized to execute commands.
 * @param {string} userId - User ID to check
 * @returns {boolean} True if authorized
 */
export function isAuthorized(userId) {
    return userId === config.ownerUserId;
}

/**
 * Creates an authorization check wrapper for command handlers.
 * @param {Function} handler - Command handler function
 * @returns {Function} Wrapped handler with authorization check
 * 
 * @example
 * const secureHandler = withAuthorization(async (interaction) => {
 *     // Only runs if user is authorized
 * });
 */
export function withAuthorization(handler) {
    return async (interaction) => {
        if (!isAuthorized(interaction.user.id)) {
            await interaction.reply({
                content: '🚫 Authorization failed. This command is restricted to the bot owner.',
                flags: 64, // Ephemeral
            });
            throw new AuthorizationError(
                'Unauthorized command execution attempt',
                'owner',
                { userId: interaction.user.id, command: interaction.commandName }
            );
        }
        return handler(interaction);
    };
}

/**
 * Creates an error handling wrapper for command handlers.
 * @param {Function} handler - Command handler function
 * @returns {Function} Wrapped handler with error handling
 */
export function withErrorHandler(handler) {
    const logger = getLogger();

    return async (interaction) => {
        try {
            return await handler(interaction);
        } catch (error) {
            logger.error(`Command execution error: /${interaction.commandName}`, error);

            // Try to reply with error message
            const errorMessage = `🔴 **Command failed!** Error: ${error.message}`;

            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ content: errorMessage });
                } else {
                    await interaction.reply({ content: errorMessage, flags: 64 });
                }
            } catch {
                // Ignore reply errors
            }

            throw error;
        }
    };
}

/**
 * Creates a defer wrapper for command handlers.
 * Automatically defers the reply to allow for longer processing.
 * @param {Function} handler - Command handler function
 * @param {boolean} [ephemeral=true] - Whether the response should be ephemeral
 * @returns {Function} Wrapped handler with automatic defer
 */
export function withDefer(handler, ephemeral = true) {
    return async (interaction) => {
        await interaction.deferReply({ flags: ephemeral ? 64 : 0 });
        return handler(interaction);
    };
}

/**
 * Combines multiple decorators into a single wrapper.
 * Decorators are applied in order (first to last).
 * @param {...Function} decorators - Decorator functions
 * @returns {Function} Combined decorator
 * 
 * @example
 * const secureHandler = compose(
 *     withAuthorization,
 *     withDefer,
 *     withErrorHandler
 * )(myHandler);
 */
export function compose(...decorators) {
    return (handler) => {
        return decorators.reduceRight(
            (wrapped, decorator) => decorator(wrapped),
            handler
        );
    };
}

/**
 * Standard command decorator combining authorization, defer, and error handling.
 * @type {Function}
 */
export const standardCommandWrapper = compose(
    withErrorHandler,
    withDefer,
    withAuthorization
);

export default {
    isAuthorized,
    withAuthorization,
    withErrorHandler,
    withDefer,
    compose,
    standardCommandWrapper,
};