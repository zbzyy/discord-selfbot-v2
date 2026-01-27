/**
 * @fileoverview Updater utility for git operations and process control.
 * @module utils/updater
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { spawn } from 'child_process';

const execAsync = promisify(exec);

/**
 * Pulls the latest changes from the git repository.
 * @returns {Promise<boolean>} True if successful
 */
export async function pullUpdates() {
    try {
        await execAsync('git fetch origin');

        const { stdout: status } = await execAsync('git status -uno');
        if (status.includes('Your branch is up to date')) {
            console.log('[Updater] Branch is already up to date.');
            return 'NO_CHANGES';
        }

        console.log('[Updater] Resetting to origin/master...');
        await execAsync('git reset --hard origin/master');

        return 'UPDATED';
    } catch (error) {
        console.error('[Updater] Update failed:', error);
        return 'FAILED';
    }
}

/**
 * Restarts the current process.
 * Spawns a new independent process and exits the current one.
 */
export function restartProcess() {
    console.log('[Updater] Restarting process...');

    const child = spawn(process.argv[0], process.argv.slice(1), {
        detached: true,
        stdio: 'inherit'
    });

    child.unref();
    process.exit(0);
}

/**
 * Gets the current short git commit hash.
 * @returns {Promise<string|null>} Short hash or null if failed
 */
export async function getCommitHash() {
    try {
        const { stdout } = await execAsync('git rev-parse --short HEAD');
        return stdout.trim();
    } catch (error) {
        return null;
    }
}
