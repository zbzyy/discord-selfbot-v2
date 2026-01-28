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
        // Fetch first to ensure we have the latest remote state
        await execAsync('git fetch origin master');

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

        // Check if local files differ from remote
        // This checks actual file content, not just commits
        const { stdout: statusOutput } = await execAsync('git status -uno');
        const { stdout: diffOutput } = await execAsync('git diff HEAD origin/master --name-only');

        // Get the current commit hash before resetting
        const { stdout: currentCommit } = await execAsync('git rev-parse HEAD');
        const beforeCommit = currentCommit.trim();

        // Get remote commit hash
        const { stdout: remoteCommit } = await execAsync('git rev-parse origin/master');
        const afterCommit = remoteCommit.trim();

        // If commits are the same AND no file differences, nothing to update
        if (beforeCommit === afterCommit && !diffOutput.trim()) {
            return 'NO_CHANGES';
        }

        // Reset to remote, discarding any local changes or commits
        await execAsync('git reset --hard origin/master');

        // Also clean any untracked files
        await execAsync('git clean -fd');

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

    // Use dynamic import with then() instead of await
    import('child_process').then(({ spawn }) => {
        const child = spawn(process.execPath, args, {
            detached: true,
            stdio: 'ignore', // Changed from 'inherit' to 'ignore' to fully detach
            shell: false
        });

        // Detach the child process so it continues after parent exits
        child.unref();

        // Give the child process more time to start before we exit
        setTimeout(() => {
            process.exit(0);
        }, 500);
    }).catch(err => {
        console.error('[Updater] Failed to restart:', err);
        process.exit(1);
    });
}