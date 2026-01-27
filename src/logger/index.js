/**
 * @fileoverview Structured logging module with configurable levels and styled output.
 * Provides colored console output and file logging for audit trails.
 * @module logger
 */

import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { timestamp, logLevel, BRAND, clearLine } from './ui.js';

/** Log level priority mapping */
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

/**
 * Logger class providing structured logging with levels.
 */
class Logger {
    /**
     * Creates a Logger instance.
     * @param {Object} options - Logger options
     * @param {string} [options.level='info'] - Minimum log level
     * @param {string} [options.logDir='./intel_logs'] - Directory for file logs
     * @param {string} [options.prefix=''] - Prefix for all log messages
     */
    constructor(options = {}) {
        this.level = options.level || 'info';
        this.logDir = options.logDir || './intel_logs';
        this.prefix = options.prefix || '';
        this._ensureLogDir();
    }

    /**
     * Ensures the log directory exists.
     * @private
     */
    async _ensureLogDir() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
        } catch {
            // Ignore errors
        }
    }

    /**
     * Checks if a message at the given level should be logged.
     * @private
     * @param {string} level - Log level to check
     * @returns {boolean} True if message should be logged
     */
    _shouldLog(level) {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
    }

    /**
     * Formats the prefix for log output.
     * @private
     * @returns {string} Formatted prefix
     */
    _formatPrefix() {
        return this.prefix ? BRAND.dim(`[${this.prefix}]`) + ' ' : '';
    }

    /**
     * Logs a debug message.
     * @param {string} message - Message to log
     */
    debug(message) {
        if (!this._shouldLog('debug')) return;
        console.log(`  ${timestamp()} ${logLevel.debug()} ${this._formatPrefix()}${BRAND.dim(message)}`);
    }

    /**
     * Logs an info message.
     * @param {string} message - Message to log
     */
    info(message) {
        if (!this._shouldLog('info')) return;
        console.log(`  ${timestamp()} ${logLevel.info()} ${this._formatPrefix()}${chalk.white(message)}`);
    }

    /**
     * Logs a warning message.
     * @param {string} message - Message to log
     */
    warn(message) {
        if (!this._shouldLog('warn')) return;
        console.log(`  ${timestamp()} ${logLevel.warn()} ${this._formatPrefix()}${BRAND.warning(message)}`);
    }

    /**
     * Logs an error message.
     * @param {string} message - Message to log
     * @param {Error} [error] - Optional error object
     */
    error(message, error = null) {
        console.log(`  ${timestamp()} ${logLevel.error()} ${this._formatPrefix()}${BRAND.error(message)}`);
        if (error?.stack) {
            const stackLines = error.stack.split('\n').slice(1, 4);
            stackLines.forEach(line => {
                console.log(`  ${BRAND.dim('     │')} ${BRAND.dim(line.trim())}`);
            });
        }
    }

    /**
     * Logs a success message.
     * @param {string} message - Success message
     */
    success(message) {
        console.log(`  ${timestamp()} ${logLevel.success()} ${this._formatPrefix()}${BRAND.success(message)}`);
    }

    /**
     * Logs an alert message.
     * @param {string} type - Alert type
     * @param {string} message - Alert message
     */
    alert(type, message) {
        console.log(`  ${timestamp()} ${BRAND.error.bold(`[${type}]`)} ${BRAND.warning(message)}`);
    }

    /**
     * Logs a plain message without level prefix.
     * @param {string} message - Message to log
     */
    plain(message) {
        console.log(`  ${timestamp()} ${this._formatPrefix()}${message}`);
    }

    /**
     * Writes progress to stdout (overwrites current line).
     * @param {string} message - Progress message
     */
    progress(message) {
        process.stdout.write(`\r  ${timestamp()} ${BRAND.secondary('◌')} ${BRAND.muted(message)}${''.padEnd(20)}`);
    }

    /**
     * Ends a progress line with a newline.
     */
    progressEnd() {
        clearLine();
    }

    /**
     * Writes a log entry to a file.
     * @param {string} filename - Log filename
     * @param {string} content - Content to log
     */
    async toFile(filename, content) {
        try {
            const ts = dayjs().format('YYYY-MM-DD HH:mm:ss');
            const logPath = path.join(this.logDir, filename);
            await fs.appendFile(logPath, `[${ts}] ${content}\n`);
        } catch {
            // Ignore file write errors
        }
    }

    /**
     * Creates a child logger with a specific prefix.
     * @param {string} prefix - Prefix for the child logger
     * @returns {Logger} New logger instance with prefix
     */
    child(prefix) {
        return new Logger({
            level: this.level,
            logDir: this.logDir,
            prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix,
        });
    }
}

// Singleton instance
let loggerInstance = null;

/**
 * Gets or creates the logger instance.
 * @param {Object} [options] - Logger options (only used on first call)
 * @returns {Logger} Logger instance
 */
export function getLogger(options = {}) {
    if (!loggerInstance) {
        loggerInstance = new Logger(options);
    }
    return loggerInstance;
}

/**
 * Initializes the logger with configuration.
 * @param {Object} config - Configuration object
 * @returns {Logger} Initialized logger
 */
export function initLogger(config) {
    loggerInstance = new Logger({
        level: config.logLevel || 'info',
        logDir: config.logDir || './intel_logs',
    });
    return loggerInstance;
}

export { Logger };
export default getLogger;