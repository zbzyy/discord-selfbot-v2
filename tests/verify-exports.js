
import path from 'path';
import { promises as fs } from 'fs';
import { config } from '../src/config/index.js';
import { ensureDir, safeWriteFile, sanitizeFilename } from '../src/utils/file.js';

async function verifyExports() {
    console.log('Verifying Export Structure...');
    console.log(`Config Export Dir: ${config.exportDir}`);

    if (config.exportDir !== './exports') {
        console.error('FAIL: config.exportDir should be "./exports"');
        process.exit(1);
    }

    // Simulate Scraper Deep Logic
    const channel = { name: 'general-chat', id: '1234567890' };
    const safeChannelName = channel.name.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
    const exportDirNameDeep = `${safeChannelName}_${channel.id}`;
    const targetDirDeep = path.join(config.exportDir, exportDirNameDeep);
    const filePathDeep = path.join(targetDirDeep, 'test_message.json');

    console.log(`[Deep Scraper] Expected Path: ${targetDirDeep}`);

    await safeWriteFile(filePathDeep, JSON.stringify({ test: true }));

    try {
        await fs.access(filePathDeep);
        console.log('PASS: Deep Scraper file created successfully.');
    } catch (e) {
        console.error('FAIL: Deep Scraper file not created.', e);
    }

    // Simulate Scraper Media Logic
    const user = { username: 'cool-user', id: '0987654321' };
    const safeUsername = sanitizeFilename(user.username);
    const exportDirNameMedia = `${safeUsername}_${user.id}`;
    const targetDirMedia = path.join(config.exportDir, exportDirNameMedia);

    console.log(`[Media Scraper] Expected Path: ${targetDirMedia}`);

    await ensureDir(targetDirMedia);

    try {
        await fs.access(targetDirMedia);
        console.log('PASS: Media Scraper directory created successfully.');
    } catch (e) {
        console.error('FAIL: Media Scraper directory not created.', e);
    }

    // Cleanup
    await fs.rm('./exports', { recursive: true, force: true });
    console.log('Cleanup complete.');
}

verifyExports().catch(console.error);
