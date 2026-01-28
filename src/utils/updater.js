/**
 * @fileoverview Update management utility for Git-based updates.
 * Handles pulling updates and restarting the process.
 * @module utils/updater
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Gets the current Git commit hash.
 * @returns {Promise<string>} Short commit hash (7 chars)
 */
export async function getCommitHash() {
    try {
        const { stdout } = await execAsync('git rev-parse --short=7 HEAD');
        return stdout.trim();
    } catch (error) {
        return 'unknown';
    }
}

/**
 * Gets the full Git commit hash.
 * @returns {Promise<string>} Full commit hash
 */
export async function getFullCommitHash() {
    try {
        const { stdout } = await execAsync('git rev-parse HEAD');
        return stdout.trim();
    } catch (error) {
        return 'unknown';
    }
}

/**
 * Gets detailed information about the Git diff.
 * @returns {Promise<Object>} Object containing files changed count and list of changed files
 */
export async function getGitDiffStats() {
    try {
        const { stdout: diffStats } = await execAsync('git diff --stat HEAD origin/master');
        const { stdout: diffFiles } = await execAsync('git diff --name-only HEAD origin/master');

        const filesList = diffFiles.trim().split('\n').filter(Boolean);
        const filesChanged = filesList.length;

        return {
            filesChanged,
            files: filesList
        };
    } catch (error) {
        return {
            filesChanged: 0,
            files: []
        };
    }
}

/**
 * Pulls the latest updates from the remote repository.
 * @returns {Promise<string>} Status of the pull operation: 'UPDATED', 'NO_CHANGES', or 'ERROR'
 */
export async function pullUpdates() {
    try {
        // Fetch the latest changes first
        await execAsync('git fetch origin master');

        // Check if there are any changes
        const { stdout: behindCount } = await execAsync('git rev-list HEAD..origin/master --count');

        if (behindCount.trim() === '0') {
            return 'NO_CHANGES';
        }

        // Pull the changes
        const { stdout, stderr } = await execAsync('git pull origin master');

        // Check if the pull was successful
        if (stdout.includes('Already up to date') || stdout.includes('Already up-to-date')) {
            return 'NO_CHANGES';
        }

        if (stderr && stderr.includes('error')) {
            console.error('[Updater] Git pull error:', stderr);
            return 'ERROR';
        }

        return 'UPDATED';
    } catch (error) {
        console.error('[Updater] Pull failed:', error);
        return 'ERROR';
    }
}

/**
 * Restarts the current Node.js process.
 * Uses process.execPath to restart with the same Node version.
 */
export function restartProcess() {
    console.log('[Updater] Restarting process...');

    // Get the original command line arguments
    const args = process.argv.slice(1);

    // Spawn a new process with the same arguments
    const { spawn } = require('child_process');
    const child = spawn(process.execPath, args, {
        detached: true,
        stdio: 'inherit'
    });

    // Detach the child process so it continues after parent exits
    child.unref();

    // Exit the current process
    process.exit(0);
}