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
        const { stdout, stderr } = await execAsync('git pull');

        console.log('[Updater] Git pull output:', stdout);

        if (stdout.includes('Already up to date')) {
            return 'NO_CHANGES';
        }

        if (stderr && !stderr.includes('Array')) { // Basic filter, 'Already up to date' sometimes appears in stderr too depending on git version/config? Usually stdout.
            // git pull output usually goes to stdout, fetch info goes to stderr.
            // We can assume success if no error thrown by execAsync, unless it's "Already up to date"
        }

        return 'UPDATED';
    } catch (error) {
        console.error('[Updater] Git pull failed:', error);
        return 'ERROR';
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
