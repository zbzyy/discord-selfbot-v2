/**
 * @fileoverview Presence event handlers.
 * Handles user presence updates (online/offline/activity changes).
 * This feature is disabled by default due to privacy concerns.
 * @module events/presence
 */

import { config } from '../config/index.js';
import { getLogger } from '../logger/index.js';

/**
 * Creates presence event handlers for the self-bot client.
 * @param {Client} selfBotClient - Self-bot client instance
 * @returns {Object} Event handler functions
 */
export function createPresenceEventHandlers(selfBotClient) {
    const logger = getLogger().child('Presence');

    /**
     * Handles presence updates.
     * @param {Presence} oldPresence - Old presence state
     * @param {Presence} newPresence - New presence state
     */
    async function handlePresenceUpdate(oldPresence, newPresence) {
        // Check if presence logging is enabled
        if (!config.logPresence) return;

        // Presence tracking is minimized for privacy
        // This is a placeholder for potential future implementation
        const user = newPresence?.user;
        if (!user) return;

        const oldStatus = oldPresence?.status || 'unknown';
        const newStatus = newPresence?.status || 'unknown';

        // Only log significant changes
        if (oldStatus === newStatus) return;

        logger.debug(`${user.tag}: ${oldStatus} -> ${newStatus}`);
    }

    return {
        handlePresenceUpdate,
    };
}

export default { createPresenceEventHandlers };