/**
 * @fileoverview Styled console UI utilities.
 * Provides beautiful terminal output inspired by modern CLI tools.
 * @module logger/ui
 */

import chalk from 'chalk';

/** Brand colors */
const BRAND = {
    primary: chalk.hex('#7C3AED'),    // Purple
    secondary: chalk.hex('#06B6D4'),  // Cyan
    accent: chalk.hex('#F59E0B'),     // Amber
    success: chalk.hex('#10B981'),    // Emerald
    error: chalk.hex('#EF4444'),      // Red
    warning: chalk.hex('#F59E0B'),    // Amber
    muted: chalk.hex('#6B7280'),      // Gray
    dim: chalk.hex('#4B5563'),        // Dark gray
};

/** Box drawing characters */
const BOX = {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    horizontal: '─',
    vertical: '│',
    teeRight: '├',
    teeLeft: '┤',
};

/**
 * Creates a horizontal line.
 * @param {number} width - Line width
 * @param {string} [char='─'] - Character to use
 * @returns {string} Horizontal line
 */
function hLine(width, char = BOX.horizontal) {
    return char.repeat(width);
}

/**
 * Centers text within a given width.
 * @param {string} text - Text to center
 * @param {number} width - Total width
 * @returns {string} Centered text
 */
function centerText(text, width) {
    const stripped = text.replace(/\x1b\[[0-9;]*m/g, ''); // Remove ANSI codes
    const padding = Math.max(0, Math.floor((width - stripped.length) / 2));
    return ' '.repeat(padding) + text;
}

/**
 * Pads text to a specific length.
 * @param {string} text - Text to pad
 * @param {number} width - Target width
 * @returns {string} Padded text
 */
function padText(text, width) {
    const stripped = text.replace(/\x1b\[[0-9;]*m/g, '');
    const padding = Math.max(0, width - stripped.length);
    return text + ' '.repeat(padding);
}

/**
 * Prints the startup banner.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

export function printBanner() {
    const p1 = chalk.hex('#7C3AED'); // Deep purple
    const p2 = chalk.hex('#A855F7'); // Purple
    const p3 = chalk.hex('#D946EF'); // Pink-purple
    const p4 = chalk.hex('#EC4899'); // Pink

    console.log('');
    console.log('');
    console.log(BRAND.dim('    automation suite') + BRAND.muted(' · ') + BRAND.dim(`v${pkg.version}`));
    console.log('');
}

/**
 * Prints a section header.
 * @param {string} title - Section title
 */
export function printSection(title) {
    console.log('');
    console.log(BRAND.dim('  ' + hLine(4) + ' ') + BRAND.primary.bold(title) + BRAND.dim(' ' + hLine(40)));
}

/**
 * Prints a status line.
 * @param {string} label - Status label
 * @param {string} value - Status value
 * @param {string} [status='info'] - Status type: 'success', 'error', 'warning', 'info'
 */
export function printStatus(label, value, status = 'info') {
    const icons = {
        success: BRAND.success('✓'),
        error: BRAND.error('✗'),
        warning: BRAND.warning('!'),
        info: BRAND.secondary('○'),
        pending: BRAND.muted('◌'),
    };

    const icon = icons[status] || icons.info;
    const labelText = BRAND.muted(padText(label, 20));
    const valueText = status === 'success' ? BRAND.success(value) : status === 'error' ? BRAND.error(value) : status === 'warning' ? BRAND.warning(value) : chalk.white(value);

    console.log(`  ${icon} ${labelText} ${valueText}`);
}

/**
 * Prints a success message with icon.
 * @param {string} message - Success message
 */
export function printSuccess(message) {
    console.log(`  ${BRAND.success('✓')} ${BRAND.success(message)}`);
}

/**
 * Prints an error message with icon.
 * @param {string} message - Error message
 */
export function printError(message) {
    console.log(`  ${BRAND.error('✗')} ${BRAND.error(message)}`);
}

/**
 * Prints a warning message with icon.
 * @param {string} message - Warning message
 */
export function printWarning(message) {
    console.log(`  ${BRAND.warning('!')} ${BRAND.warning(message)}`);
}

/**
 * Prints an info message.
 * @param {string} message - Info message
 */
export function printInfo(message) {
    console.log(`  ${BRAND.secondary('○')} ${BRAND.muted(message)}`);
}

/**
 * Prints a divider line.
 */
export function printDivider() {
    console.log(BRAND.dim('  ' + hLine(56)));
}

/**
 * Creates a spinner-like progress indicator.
 * @param {string} message - Progress message
 */
export function printProgress(message) {
    process.stdout.write(`\r  ${BRAND.secondary('◌')} ${BRAND.muted(message)}`);
}

/**
 * Clears the current line.
 */
export function clearLine() {
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
}

/**
 * Prints the ready status section (same style as Connecting).
 * @param {Object} status - Status object
 * @param {string} status.selfBot - Self-bot user tag
 * @param {string} status.commandBot - Command bot user tag
 * @param {number} status.commands - Number of registered commands
 */
export function printReadyBox(status) {
    console.log('');
    console.log(BRAND.dim('  ' + hLine(4) + ' ') + BRAND.success.bold('Online') + BRAND.dim(' ' + hLine(44)));
    printStatus('Self-Bot', status.selfBot || 'Unknown', 'success');
    printStatus('Command Bot', status.commandBot || 'Unknown', 'success');
    printStatus('Commands', status.commands + ' registered', 'success');
}

/**
 * Formats a log timestamp.
 * @returns {string} Formatted timestamp
 */
export function timestamp() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return BRAND.dim(`${h}:${m}:${s}`);
}

/**
 * Log level formatters.
 */
export const logLevel = {
    debug: () => BRAND.dim('[DBG]'),
    info: () => BRAND.secondary('[INF]'),
    warn: () => BRAND.warning('[WRN]'),
    error: () => BRAND.error('[ERR]'),
    success: () => BRAND.success('[OK!]'),
};

export { BRAND };
export default {
    printBanner,
    printSection,
    printStatus,
    printSuccess,
    printError,
    printWarning,
    printInfo,
    printDivider,
    printProgress,
    clearLine,
    printReadyBox,
    timestamp,
    logLevel,
    BRAND,
};