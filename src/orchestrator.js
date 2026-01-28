/**
 * @fileoverview Main Orchestrator class.
 * Manages both Discord clients and coordinates all operations.
 * 
 * @warning This application uses discord.js-selfbot-v13 which violates
 * Discord's Terms of Service. Use at your own risk.
 * @module orchestrator
 */

import { Client as SelfBotClient } from 'discord.js-selfbot-v13';
import { Client, GatewayIntentBits } from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';

import { config } from './config/index.js';
import { getLogger, initLogger } from './logger/index.js';
import { printBanner, printSection, printStatus, printReadyBox, printSuccess, printError, printInfo, BRAND } from './logger/ui.js';
import { initDiscordService } from './services/discord.js';
import { getWebhookService } from './services/webhook.js';
import { getCommandRegistry } from './commands/registry.js';
import { COMMAND_DEFINITIONS } from './commands/definitions.js';
import { createMessageEventHandlers } from './events/message.js';
import { createPresenceEventHandlers } from './events/presence.js';
import { delay } from './utils/delay.js';
import { ensureDir } from './utils/file.js';
import { isNewerVersion } from './utils/version.js';

import {
    handleHelp,
    handleScraperDeep,
    handleScraperMedia,
    handleAuditorStats,
    handleAuditorProfile,
    handleCleanerSelfpurge,
    handleCleanerBulk,
    handleNukeList,
    handleNukeChannels,
    handleNukeServer,
    handlePost,
} from './commands/handlers/index.js';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

import { pullUpdates, restartProcess, getCommitHash, getFullCommitHash, getGitDiffStats, checkForUpdates, getRemoteVersion } from './utils/updater.js';
import { EmbedColors } from './services/webhook.js';

/**
 * Main Orchestrator class that manages both Discord clients.
 */
export class Orchestrator {
    /**
     * Creates an Orchestrator instance.
     */
    constructor() {
        this.logger = initLogger(config);
        this.isShuttingDown = false;
        this.isSelfBotLoggingIn = false;

        this.selfBotReady = false;
        this.commandBotReady = false;
        this.hasShownReady = false;

        this.selfBotClient = new SelfBotClient({
            checkUpdate: false,
        });
        
        this.commandBotClient = new Client({
            intents: [GatewayIntentBits.Guilds],
        });

        this.discordService = null;
        this.webhook = getWebhookService();
        this.commandRegistry = getCommandRegistry();

        this._registerCommands();
        this._setupEventHandlers();
        this._setupProcessHandlers();
    }

    /**
     * Registers all command handlers with the registry.
     * @private
     */
    _registerCommands() {
        const registry = this.commandRegistry;

        registry.register('help', handleHelp);
        registry.register('scraper_deep', handleScraperDeep);
        registry.register('scraper_media', handleScraperMedia);
        registry.register('auditor_stats', handleAuditorStats);
        registry.register('auditor_profile', handleAuditorProfile);
        registry.register('cleaner_selfpurge', handleCleanerSelfpurge);
        registry.register('cleaner_bulk', handleCleanerBulk);
        registry.register('nuke_list', handleNukeList);
        registry.register('nuke_channels', handleNukeChannels);
        registry.register('nuke_server', handleNukeServer);
        registry.register('post', handlePost);

        this.logger.debug(`Registered ${registry.size} commands`);
    }

    /**
     * Sets up all event handlers for both clients.
     * @private
     */
    _setupEventHandlers() {
        this.selfBotClient.on('ready', () => this._onSelfBotReady());

        const messageHandlers = createMessageEventHandlers(this.selfBotClient);
        this.selfBotClient.on('messageCreate', messageHandlers.handleMessageCreate);
        this.selfBotClient.on('messageDelete', messageHandlers.handleMessageDelete);
        this.selfBotClient.on('messageUpdate', messageHandlers.handleMessageUpdate);

        const presenceHandlers = createPresenceEventHandlers(this.selfBotClient);
        this.selfBotClient.on('presenceUpdate', presenceHandlers.handlePresenceUpdate);

        this.selfBotClient.on('error', (error) => this._handleClientError(error, 'SELF-BOT'));

        this.commandBotClient.once('ready', () => this._onCommandBotReady());
        this.commandBotClient.on('interactionCreate', (i) => this._handleInteraction(i));
        this.commandBotClient.on('error', (error) => this._handleClientError(error, 'COMMAND-BOT'));
    }

    /**
     * Sets up process-level handlers for graceful shutdown.
     * @private
     */
    _setupProcessHandlers() {
        const originalWarn = process.emitWarning;
        process.emitWarning = (warning, ...args) => {
            if (typeof warning === 'string' && warning.includes('ready event has been renamed')) {
                return; 
            }
            originalWarn.call(process, warning, ...args);
        };

        process.on('unhandledRejection', (error) => {
            this.logger.error('Unhandled rejection', error);
            this.logger.toFile('errors.txt', `[UNHANDLED REJECTION] ${error?.stack || error}`);
        });

        process.on('uncaughtException', (error) => {
            this.logger.error('Uncaught exception', error);
            this.logger.toFile('errors.txt', `[UNCAUGHT EXCEPTION] ${error?.stack || error}`);
            this.shutdown(1);
        });

        process.on('SIGINT', () => this.shutdown(0));
        process.on('SIGTERM', () => this.shutdown(0));
    }

    /**
     * Handles client errors with potential recovery.
     * @private
     * @param {Error} error - The error that occurred
     * @param {string} source - Error source identifier
     */
    _handleClientError(error, source) {
        if (this.isShuttingDown) return;

        if (source === 'SELF-BOT' &&
            (error.message?.includes('Invalid Session') || error.message?.includes('Not logged in'))) {
            this.logger.warn(`${source} session error detected, attempting re-login...`);
            this.selfBotClient.destroy().then(() => this._retryLogin());
        } else {
            this.logger.error(`${source} error`, error);
            this.logger.toFile('errors.txt', `[${source}] ${error?.stack || error}`);
        }
    }

    /**
     * Called when self-bot client is ready.
     * @private
     */
    async _onSelfBotReady() {
        const user = this.selfBotClient.user;
        this.selfBotReady = true;

        this.discordService = initDiscordService(this.selfBotClient, this.commandBotClient);

        await this.logger.toFile('session.txt', `[LOGIN] ${user.tag} logged in successfully.`);

        this._checkAllReady();
    }

    /**
     * Called when command bot client is ready.
     * @private
     */
    async _onCommandBotReady() {
        this.commandBotReady = true;
        this._checkAllReady();
    }

    /**
     * Checks if all clients are ready and prints status.
     * @private
     */
    async _checkAllReady() {
        if (this.selfBotReady && this.commandBotReady && !this.hasShownReady) {
            this.hasShownReady = true;
            printReadyBox({
                selfBot: this.selfBotClient.user?.tag,
                commandBot: this.commandBotClient.user?.tag,
                commands: this.commandRegistry.size,
            });

            printSection('Monitoring Active');
            printInfo('Listening for keyword triggers and message events...');
            console.log('');

            const commitHash = await getCommitHash();

            console.log(BRAND.dim(`  Commit: ${commitHash}`));

            await this.webhook.notifyOnline(
                this.selfBotClient.user?.tag,
                this.commandBotClient.user?.tag,
                commitHash
            ).catch(() => { });

            await this._registerSlashCommands();
        }
    }

    /**
     * Registers slash commands with Discord API.
     * @private
     */
    async _registerSlashCommands() {
        const rest = new REST({ version: '9' }).setToken(config.botToken);

        try {
            await rest.put(
                Routes.applicationCommands(this.commandBotClient.user.id),
                { body: COMMAND_DEFINITIONS }
            );
            this.logger.success('Slash commands registered');
        } catch (error) {
            this.logger.error('Failed to register slash commands', error);
            throw error;
        }
    }

    /**
     * Handles incoming interactions (slash commands).
     * @private
     * @param {Interaction} interaction - Discord interaction
     */
    async _handleInteraction(interaction) {
        if (!interaction.isCommand()) return;

        this.logger.info(`Command: /${interaction.commandName} by ${interaction.user.tag}`);
        await this.commandRegistry.execute(interaction.commandName, interaction);
    }

    /**
     * Attempts to login a client with error handling.
     * @private
     * @param {Client} client - Discord client
     * @param {string} token - Authentication token
     * @param {string} name - Client name for logging
     */
    async _attemptLogin(client, token, name) {
        try {
            await client.login(token);
            printStatus(name, 'Connected', 'success');
        } catch (error) {
            printStatus(name, 'Failed', 'error');
            throw new Error(`${name} login failed: ${error.message}`);
        }
    }

    /**
     * Retries self-bot login after a failure.
     * @private
     */
    async _retryLogin() {
        if (this.isSelfBotLoggingIn || this.isShuttingDown) return;
        this.isSelfBotLoggingIn = true;

        try {
            await delay(5000);
            await this.selfBotClient.login(config.selfToken);
        } catch (error) {
            this.logger.error('Self-bot re-login failed', error);
            await this.logger.toFile('errors.txt', `[SELF-BOT RE-LOGIN FAILED] ${error.message}`);
            await this.shutdown(1);
        } finally {
            this.isSelfBotLoggingIn = false;
        }
    }

    /**
     * Checks for updates from the GitHub repository.
     * @private
     */
    async _checkUpdate() {
        try {
            const hasUpdate = await checkForUpdates();
            const currentVersion = pkg.version;

            if (hasUpdate) {
                const remoteVersion = await getRemoteVersion();

                console.log('');
                console.log(BRAND.dim('  ' + '─'.repeat(4) + ' ') + BRAND.accent.bold('Update Available') + BRAND.dim(' ' + '─'.repeat(38)));
                console.log(`  ${BRAND.accent('!')}  Changes detected. Updating...`);
                console.log('');

                // Get current commit hash and diff stats before updating
                const oldCommitHash = await getCommitHash();
                const oldFullHash = await getFullCommitHash();

                // Get diff stats before pulling
                const diffStats = await getGitDiffStats();

                // Send update found notification
                await this.webhook.send([{
                    title: 'Update available',
                    description: 'A new version has been detected',
                    color: EmbedColors.INFO,
                    fields: [
                        {
                            name: 'Current version',
                            value: `\`${currentVersion}\``,
                            inline: true
                        },
                        {
                            name: 'New version',
                            value: `\`${remoteVersion}\``,
                            inline: true
                        },
                        {
                            name: 'Current commit',
                            value: `[\`${oldCommitHash}\`](https://github.com/zbzyy/discord-selfbot-v2/commit/${oldFullHash})`,
                            inline: false
                        }
                    ],
                    timestamp: new Date().toISOString()
                }], { username: 'updater' }).catch(() => { });

                console.log(BRAND.dim('  ' + '─'.repeat(4) + ' ') + BRAND.accent.bold('Auto-Updating...') + BRAND.dim(' ' + '─'.repeat(40)));

                // Perform the update
                const status = await pullUpdates();

                if (status === 'NO_CHANGES') {
                    console.log(`  ${BRAND.warning('!')} Git reported no changes, but version mismatch detected.`);
                    console.log(`  ${BRAND.warning('!')} Force resetting to remote state...`);

                    try {
                        const { exec } = await import('child_process');
                        const { promisify } = await import('util');
                        const execAsync = promisify(exec);
                        await execAsync('git fetch origin master');
                        await execAsync('git reset --hard origin/master');
                        await execAsync('git clean -fd');

                        const newCommitHash = await getCommitHash();
                        const newFullHash = await getFullCommitHash();

                        console.log(`  ${BRAND.success('✓')} Force reset successful. Restarting...`);

                        await this.webhook.send([{
                            title: 'Update complete',
                            description: 'Force reset to remote due to version mismatch',
                            color: EmbedColors.SUCCESS,
                            fields: [
                                {
                                    name: 'Version',
                                    value: `\`${currentVersion}\` → \`${remoteVersion}\``,
                                    inline: true
                                },
                                {
                                    name: 'Commit',
                                    value: `[\`${newCommitHash}\`](https://github.com/zbzyy/discord-selfbot-v2/commit/${newFullHash})`,
                                    inline: true
                                },
                                {
                                    name: 'Note',
                                    value: 'Git reported no new commits, but package.json version changed. Local files were reset to match remote.',
                                    inline: false
                                }
                            ],
                            timestamp: new Date().toISOString()
                        }], { username: 'updater' }).catch(() => { });

                        await new Promise(resolve => setTimeout(resolve, 2000));

                        restartProcess();
                        return true;
                    } catch (error) {
                        console.log(`  ${BRAND.error('✗')} Force reset failed.`);
                    }
                }

                if (status === 'UPDATED') {
                    const newCommitHash = await getCommitHash();
                    const newFullHash = await getFullCommitHash();

                    console.log(`  ${BRAND.success('✓')} Update successful. Restarting...`);

                    await this.webhook.send([{
                        title: 'Update complete',
                        description: 'Successfully updated to the latest version',
                        color: EmbedColors.SUCCESS,
                        fields: [
                            {
                                name: 'Version',
                                value: `\`${currentVersion}\` → \`${remoteVersion}\``,
                                inline: true
                            },
                            {
                                name: 'Files changed',
                                value: `\`${diffStats.filesChanged}\` files`,
                                inline: true
                            },
                            {
                                name: 'Commits',
                                value: `[\`${oldCommitHash}\`](https://github.com/zbzyy/discord-selfbot-v2/commit/${oldFullHash}) → [\`${newCommitHash}\`](https://github.com/zbzyy/discord-selfbot-v2/commit/${newFullHash})`,
                                inline: false
                            },
                            {
                                name: 'Changed files',
                                value: diffStats.files.length > 0
                                    ? '```\n' + diffStats.files.slice(0, 10).join('\n') + (diffStats.files.length > 10 ? `\n... and ${diffStats.files.length - 10} more` : '') + '\n```'
                                    : 'No files listed',
                                inline: false
                            }
                        ],
                        timestamp: new Date().toISOString()
                    }], { username: 'updater' }).catch(() => { });

                    await new Promise(resolve => setTimeout(resolve, 2000));

                    restartProcess();
                    return true;
                } else if (status === 'ERROR') {
                    console.log(`  ${BRAND.error('✗')} Update failed.`);

                    await this.webhook.send([{
                        title: 'update failed',
                        description: 'Failed to pull updates from repository',
                        color: EmbedColors.ERROR,
                        fields: [
                            {
                                name: 'version',
                                value: `Current: \`${currentVersion}\`\nTarget: \`${remoteVersion}\``,
                                inline: true
                            },
                            {
                                name: 'commit',
                                value: `[\`${await getCommitHash()}\`](https://github.com/zbzyy/discord-selfbot-v2/commit/${await getFullCommitHash()})`,
                                inline: true
                            },
                            {
                                name: 'action required',
                                value: 'Please check console logs or update manually',
                                inline: false
                            }
                        ],
                        timestamp: new Date().toISOString()
                    }], { username: 'updater' }).catch(() => { });
                }
            }
        } catch (error) {
            this.logger.debug('Failed to check for updates', error);
            console.log('[DEBUG] Update check failed:', error);
        }
    }

    /**
     * Starts the orchestrator and both clients.
     * @returns {Promise<void>}
     */
    async start() {
        if (await this._checkUpdate()) return;

        printBanner();

        printSection('Initializing');

        await ensureDir(config.logDir);
        await ensureDir(config.downloadDir);
        printStatus('Directories', 'Ready', 'success');

        printSection('Connecting');

        try {
            await Promise.all([
                this._attemptLogin(this.selfBotClient, config.selfToken, 'Self-Bot'),
                this._attemptLogin(this.commandBotClient, config.botToken, 'Command Bot'),
            ]);
        } catch (error) {
            console.log('');
            printError(error.message);
            await this.shutdown(1);
        }
    }

    /**
     * Gracefully shuts down both clients.
     * @param {number} [exitCode=0] - Process exit code
     * @returns {Promise<void>}
     */
    async shutdown(exitCode = 0) {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;

        console.log('');
        printSection('Shutting Down');

        try {
            await Promise.allSettled([
                this.selfBotClient.destroy(),
                this.commandBotClient.destroy(),
            ]);
            printSuccess('Shutdown complete');
        } catch (error) {
            printError('Error during shutdown');
        }

        console.log('');
        process.exit(exitCode);
    }

    /**
     * Gets health status of the orchestrator.
     * @returns {Object} Health status
     */
    getHealth() {
        return {
            selfBot: {
                ready: this.selfBotReady,
                user: this.selfBotClient.user?.tag ?? null,
            },
            commandBot: {
                ready: this.commandBotReady,
                user: this.commandBotClient.user?.tag ?? null,
            },
            isShuttingDown: this.isShuttingDown,
        };
    }
}

export default Orchestrator;
