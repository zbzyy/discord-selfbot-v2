/**
 * @fileoverview Slash command definitions for Discord API registration.
 * @module commands/definitions
 */

import { config } from '../config/index.js';

/**
 * Maximum scrape limit for deep operations.
 * @type {number}
 */
const MAX_SCRAPE_LIMIT = config.maxScrapeLimit;

/**
 * Maximum self-purge limit.
 * @type {number}
 */
const SELF_PURGE_LIMIT = config.selfPurgeLimit;

/**
 * Slash command definitions for Discord API registration.
 * @type {Object[]}
 */
export const COMMAND_DEFINITIONS = [
    {
        name: 'help',
        description: 'Display all available commands and their descriptions.',
    },
    {
        name: 'scraper_deep',
        description: 'Deep backup of a channel with full message history.',
        options: [
            {
                name: 'channel_id',
                type: 3, // STRING
                description: 'ID of the channel to scrape.',
                required: true,
            },
            {
                name: 'limit',
                type: 4, // INTEGER
                description: `Max messages to scrape (0 for unlimited).`,
                required: true,
                min_value: 0,
                max_value: MAX_SCRAPE_LIMIT,
            },
            {
                name: 'format',
                type: 3, // STRING
                description: 'Export format (json or txt). Default: json',
                required: false,
                choices: [
                    { name: 'JSON', value: 'json' },
                    { name: 'Text (TXT)', value: 'txt' },
                ],
            },
        ],
    },
    {
        name: 'scraper_media',
        description: 'Archive all media files from a DM conversation.',
        options: [
            {
                name: 'user_id',
                type: 3,
                description: 'ID of the user to archive media from.',
                required: true,
            },
            {
                name: 'limit',
                type: 4,
                description: `Max messages to check (0 for unlimited).`,
                required: true,
                min_value: 0,
                max_value: MAX_SCRAPE_LIMIT,
            },
            {
                name: 'format',
                type: 3, // STRING
                description: 'Export format (json or txt). Default: json',
                required: false,
                choices: [
                    { name: 'JSON', value: 'json' },
                    { name: 'Text (TXT)', value: 'txt' },
                ],
            },
        ],
    },
    {
        name: 'auditor_stats',
        description: 'Analyze your chat activity and patterns across all DMs.',
    },
    {
        name: 'auditor_profile',
        description: 'Get detailed information on a specific Discord user.',
        options: [
            {
                name: 'user_id',
                type: 3,
                description: 'ID of the user to profile.',
                required: true,
            },
        ],
    },
    {
        name: 'cleaner_selfpurge',
        description: 'Delete all your messages in a specific channel.',
        options: [
            {
                name: 'channel_id',
                type: 3,
                description: 'ID of the channel to purge your messages from.',
                required: true,
            },
            {
                name: 'limit',
                type: 4,
                description: `How far back to check (max: ${SELF_PURGE_LIMIT}).`,
                required: true,
                min_value: 1,
                max_value: SELF_PURGE_LIMIT,
            },
        ],
    },
    {
        name: 'cleaner_bulk',
        description: 'Close all DMs and reject all pending friend requests.',
    },
    {
        name: 'nuke_list',
        description: 'List all servers you own for nuke targeting.',
    },
    {
        name: 'nuke_channels',
        description: 'Deletes ALL channels in an owned server (Structure Nuke).',
        options: [
            {
                name: 'guild_id',
                type: 3,
                description: 'ID of the server to nuke channels in.',
                required: true,
            },
        ],
    },
    {
        name: 'nuke_server',
        description: 'Deletes the ENTIRE server permanently (Full Nuke).',
        options: [
            {
                name: 'guild_id',
                type: 3,
                description: 'ID of the server to delete.',
                required: true,
            },
        ],
    },
    {
        name: 'post',
        description: 'Post a changelog or update to the updates channel.',
        options: [
            {
                name: 'title',
                type: 3, // STRING
                description: 'Title of the update.',
                required: false,
            },
            {
                name: 'content',
                type: 3, // STRING
                description: 'Content of the update (supports markdown).',
                required: false,
            },
            {
                name: 'version',
                type: 3, // STRING
                description: 'Version number (e.g. v2.0.0).',
                required: false,
            },
            {
                name: 'image',
                type: 3, // STRING
                description: 'Image URL to include.',
                required: false,
            },
        ],
    },
];

/**
 * Command categories for help display.
 * @type {Object}
 */
export const COMMAND_CATEGORIES = {
    '📥 Scraping & Archiving': [
        { name: '/scraper_deep', description: 'Deep backup of a channel with message history' },
        { name: '/scraper_media', description: 'Download all media from a DM conversation' },
    ],
    '📊 Analytics & Auditing': [
        { name: '/auditor_stats', description: 'Analyze your chat activity and patterns' },
        { name: '/auditor_profile', description: 'Get detailed information about a user' },
    ],
    '🧹 Cleanup Tools': [
        { name: '/cleaner_selfpurge', description: 'Delete all your messages in a channel' },
        { name: '/cleaner_bulk', description: 'Close all DMs and reject friend requests' },
    ],
    '💣 Server Management': [
        { name: '/nuke_list', description: 'List servers you own' },
        { name: '/nuke_channels', description: 'Delete all channels in a server' },
        { name: '/nuke_server', description: 'Delete an entire server' },
    ],
    '📢 Updates': [
        { name: '/post', description: 'Post a changelog or update' },
    ],
};

export default { COMMAND_DEFINITIONS, COMMAND_CATEGORIES };