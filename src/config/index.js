/**
 * @fileoverview Configuration management module with validation.
 * Loads settings from environment variables and validates all required values.
 * @module config
 */

import { config as dotenvConfig } from 'dotenv';

// Load environment variables from .env file
dotenvConfig();

/** Discord ID regex pattern (17-19 digit snowflake) */
const DISCORD_ID_REGEX = /^\d{17,19}$/;

/**
 * Validates that a Discord ID is properly formatted.
 * @param {string} id - The ID to validate
 * @returns {boolean} True if valid Discord snowflake ID
 */
function isValidDiscordId(id) {
    return DISCORD_ID_REGEX.test(id);
}

/**
 * Parses a comma-separated string into an array.
 * @param {string} value - Comma-separated string
 * @param {string[]} defaultValue - Default array if value is empty
 * @returns {string[]} Parsed array
 */
function parseArrayEnv(value, defaultValue = []) {
    if (!value || value.trim() === '') {
        return defaultValue;
    }
    return value.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Parses a boolean environment variable.
 * @param {string} value - String value ('true', 'false', '1', '0')
 * @param {boolean} defaultValue - Default if not set
 * @returns {boolean} Parsed boolean
 */
function parseBooleanEnv(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parses an integer environment variable.
 * @param {string} value - String value
 * @param {number} defaultValue - Default if not set or invalid
 * @returns {number} Parsed integer
 */
function parseIntEnv(value, defaultValue) {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Validates the configuration and throws on missing required values.
 * @throws {Error} If required configuration is missing or invalid
 */
function validateConfig() {
    const errors = [];

    if (!process.env.SELF_TOKEN) {
        errors.push('SELF_TOKEN is required');
    }

    if (!process.env.BOT_TOKEN) {
        errors.push('BOT_TOKEN is required');
    }

    if (!process.env.OWNER_USER_ID) {
        errors.push('OWNER_USER_ID is required');
    } else if (!isValidDiscordId(process.env.OWNER_USER_ID)) {
        errors.push('OWNER_USER_ID must be a valid Discord snowflake ID (17-19 digits)');
    }

    if (errors.length > 0) {
        throw new Error(
            `Configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}\n\n` +
            'Please check your .env file. See .env.example for reference.'
        );
    }
}

// Validate configuration on module load
validateConfig();

/**
 * Application configuration object.
 * All values are validated and frozen to prevent runtime modification.
 * @type {Readonly<Config>}
 */
export const config = Object.freeze({
    // Required tokens
    selfToken: process.env.SELF_TOKEN,
    botToken: process.env.BOT_TOKEN,
    ownerUserId: process.env.OWNER_USER_ID,

    // Optional configuration
    webhookUrl: process.env.WEBHOOK_URL || null,
    username: process.env.USERNAME || '',

    // Feature flags
    autoUpdate: parseBooleanEnv(process.env.AUTO_UPDATE, true),
    autoUpdateNotifications: parseBooleanEnv(process.env.AUTO_UPDATE_NOTIFICATIONS, true),
    watchKeywords: parseArrayEnv(
        process.env.WATCH_KEYWORDS,
        ['password', 'secret', 'admin', 'urgent']
    ).concat(process.env.USERNAME ? [process.env.USERNAME] : []),
    logEdited: parseBooleanEnv(process.env.LOG_EDITED, true),
    logPresence: parseBooleanEnv(process.env.LOG_PRESENCE, false),

    // Operational limits
    maxRetryAttempts: parseIntEnv(process.env.MAX_RETRY_ATTEMPTS, 5),
    baseDelayMs: parseIntEnv(process.env.BASE_DELAY_MS, 1000),
    maxScrapeLimit: parseIntEnv(process.env.MAX_SCRAPE_LIMIT, 100000),
    selfPurgeLimit: parseIntEnv(process.env.SELF_PURGE_LIMIT, 2000),

    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',

    // Directory paths
    logDir: './intel_logs',
    downloadDir: './media_archive', // Deprecated in favor of exportDir for new scrapers
    exportDir: './exports',

    // Validation patterns
    discordIdRegex: DISCORD_ID_REGEX,
});

/**
 * Validates a Discord ID string.
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid
 */
export function validateDiscordId(id) {
    return isValidDiscordId(id);
}

export default config;