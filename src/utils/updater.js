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
 * Gets the version from the remote package.json.
 * @returns {Promise<string>} Remote version string or 'unknown'
 */
export async function getRemoteVersion() {
    try {
        const { stdout } = await execAsync('git show origin/master:package.json');
        const pkg = JSON.parse(stdout);
        return pkg.version;
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
 * Checks if there are any updates available on the remote repository.
 * Compares the local HEAD commit hash with the remote origin/master commit hash.
 * @returns {Promise<boolean>} True if remote is different/newer, false otherwise.
 */
export async function checkForUpdates() {
    try {
        // Fetch the latest changes
        await execAsync('git fetch origin master');

        // Get local and remote hashes
        const { stdout: localHash } = await execAsync('git rev-parse HEAD');
        const { stdout: remoteHash } = await execAsync('git rev-parse origin/master');

        // Compare hashes - if different, we have an update (or at least a mismatch we want to sync)
        return localHash.trim() !== remoteHash.trim();
    } catch (error) {
        console.error('[Updater] Failed to check for updates:', error);
        return false;
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

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * Restarts the current Node.js process.
 * Uses process.execPath to restart with the same Node version.
 */
export function restartProcess() {
    console.log('[Updater] Restarting process...');

    try {
        const { spawn } = require('child_process');
        const args = process.argv.slice(1);

        // Spawn new process attached to current stdio
        const child = spawn(process.execPath, args, {
            stdio: 'inherit',
            cwd: process.cwd()
        });

        console.log('[Updater] New process started...');

        // Wait for child to exit, then exit this process with same code
        child.on('close', (code) => {
            process.exit(code || 0);
        });

    } catch (err) {
        console.error('[Updater] Failed to restart:', err);
        process.exit(1);
    }
}