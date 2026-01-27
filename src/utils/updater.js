/**
 * @fileoverview Auto-update module.
 * Handles checking for updates, backing up, pulling changes, and restarting.
 * @module utils/updater
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import dayjs from 'dayjs';
import { config } from '../config/index.js';
import {
    printSection,
    printStatus,
    printError,
    printSuccess,
    printInfo,
    BRAND
} from '../logger/ui.js';

const execAsync = promisify(exec);

/**
 * Executes a shell command and returns the output.
 * @param {string} command - Command to execute
 * @returns {Promise<string>} Command output (stdout)
 */
async function runCommand(command) {
    try {
        const { stdout } = await execAsync(command);
        return stdout.trim();
    } catch (error) {
        throw new Error(`Command failed: ${command}\n${error.message}`);
    }
}

/**
 * Sends a webhook notification.
 * @param {Object} embed - Discord embed object
 */
async function sendWebhook(embed) {
    if (!config.webhookUrl || !config.autoUpdateNotifications) return;

    try {
        await fetch(config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] }),
        });
    } catch (error) {
        // Silent fail for webhooks to not interrupt the process
    }
}

/**
 * Creates a backup of the source directory.
 * @param {string} hash - Current commit hash
 */
async function createBackup(hash) {
    const backupDir = path.resolve('backups');
    const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
    const dest = path.join(backupDir, `src_${hash}_${timestamp}`);

    try {
        await fs.mkdir(backupDir, { recursive: true });
        // Windows 'xcopy' or Linux 'cp -r'
        // Using Node fs for cross-platform
        await fs.cp('src', dest, { recursive: true });
        return dest;
    } catch (error) {
        throw new Error(`Backup failed: ${error.message}`);
    }
}

/**
 * Main auto-update routine.
 */
export async function checkForUpdates() {
    if (!config.autoUpdate) return;

    printSection('Auto-Update System');
    
    // Progress: Checking
    process.stdout.write(`  ${BRAND.secondary('⏳')} Checking for updates...`);

    try {
        // 1. Get current hash
        const currentHash = await runCommand('git rev-parse --short HEAD');
        
        // 2. Fetch remote (don't pull yet) to get latest hash
        // Use git ls-remote to avoid fetching objects if not needed yet, or fetch to update refs
        await runCommand('git fetch origin master'); 
        const remoteHash = await runCommand('git rev-parse --short origin/master');
        const commitMsg = await runCommand('git log -1 --pretty=%B origin/master');
        const author = await runCommand('git log -1 --pretty=%an origin/master');

        if (currentHash === remoteHash) {
            process.stdout.write('\r' + ' '.repeat(40) + '\r');
            printStatus('Update Check', 'Up to date', 'success');
            return;
        }

        // Update found
        process.stdout.write('\r' + ' '.repeat(40) + '\r');
        printStatus('Update Found', `${currentHash} → ${remoteHash}`, 'warning');

        // Step 1: Webhook - Fetching
        await sendWebhook({
            title: '🔄 Auto-Update Started',
            color: 0x3498db, // Blue
            fields: [
                { name: 'Current Version', value: `\`${currentHash}\``, inline: true },
                { name: 'Status', value: 'Fetching remote...', inline: true }
            ],
            footer: { text: `Nukaaaaa Updater • ${dayjs().format('HH:mm:ss')}` }
        });

        // Step 2: Webhook - Details
        await sendWebhook({
            title: '📝 Update Details',
            color: 0xf1c40f, // Yellow
            description: `**Changes:**\n${commitMsg}`,
            fields: [
                { name: 'Old Hash', value: `\`${currentHash}\``, inline: true },
                { name: 'New Hash', value: `\`${remoteHash}\``, inline: true },
                { name: 'Author', value: author, inline: true }
            ],
            footer: { text: `Nukaaaaa Updater • ${dayjs().format('HH:mm:ss')}` }
        });

        // Step 3: Downloading
        process.stdout.write(`  ${BRAND.warning('⚡')} Updating...`);
        
        await sendWebhook({
            title: '⬇️ Downloading Update',
            color: 0xe67e22, // Orange
            fields: [
                { name: 'Updating', value: `\`${currentHash}\` → \`${remoteHash}\`` },
                { name: 'Progress', value: 'Pulling from GitHub...' }
            ],
            footer: { text: `Nukaaaaa Updater • ${dayjs().format('HH:mm:ss')}` }
        });

        // Backup
        const backupPath = await createBackup(currentHash);
        
        // Pull
        await runCommand('git pull origin master');

        process.stdout.write('\r' + ' '.repeat(40) + '\r');
        printStatus('Update', 'Complete', 'success');

        // Step 4: Complete
        await sendWebhook({
            title: '✅ Update Complete',
            color: 0x2ecc71, // Green
            fields: [
                { name: 'Updated to', value: `\`${remoteHash}\`` },
                { name: 'Status', value: 'Restarting application...' }
            ],
            footer: { text: `Nukaaaaa Updater • ${dayjs().format('HH:mm:ss')}` }
        });

        printInfo('Restarting application...');
        
        // Spawn new process
        const child = spawn(process.argv[0], process.argv.slice(1), {
            detached: true,
            stdio: 'inherit'
        });
        child.unref();
        process.exit(0);

    } catch (error) {
        process.stdout.write('\r' + ' '.repeat(40) + '\r');
        printError('Update Failed');
        console.error(error); // Debug log

        // Error Embed
        await sendWebhook({
            title: '❌ Update Failed',
            color: 0xe74c3c, // Red
            fields: [
                { name: 'Error', value: error.message.substring(0, 1024) },
                { name: 'Action', value: 'Continuing with old version' }
            ],
            footer: { text: `Nukaaaaa Updater • ${dayjs().format('HH:mm:ss')}` }
        });

        // Attempt rollback if we moved HEAD
        try {
            await runCommand('git reset --hard ORIG_HEAD');
        } catch (e) {
            // Ignore rollback error if we didn't move
        }
    }
}
