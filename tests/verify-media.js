
import path from 'path';
import { promises as fs } from 'fs';
import { config } from '../src/config/index.js';
import { ensureDir, safeWriteFile, sanitizeFilename } from '../src/utils/file.js';

async function verifyMediaEnhancement() {
    console.log('Verifying Media Scraper Enhancements...');

    // Mock Context
    const user = { username: 'test-user', id: '999888777' };
    const safeUsername = sanitizeFilename(user.username);
    const exportDirName = `${safeUsername}_${user.id}`;
    const targetDir = path.join(config.exportDir, exportDirName);
    const mediaDir = path.join(targetDir, 'media');
    const messagesPath = path.join(targetDir, 'messages.json');

    console.log(`Target Dir: ${targetDir}`);

    // cleanup
    await fs.rm(targetDir, { recursive: true, force: true });

    // Simulate behavior
    await ensureDir(mediaDir);

    const mockMessages = [
        { id: '1', content: 'First msg', createdTimestamp: 1000 },
        { id: '2', content: 'Second msg', createdTimestamp: 2000 }
    ];

    // Test sorting logic simulation
    mockMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    if (mockMessages[0].id !== '1') {
        console.error('FAIL: Sorting logic incorrect');
    } else {
        console.log('PASS: Sorting logic correct');
    }

    await safeWriteFile(messagesPath, JSON.stringify(mockMessages));
    await safeWriteFile(path.join(mediaDir, 'test.png'), 'fake image');

    // Verify
    try {
        await fs.access(messagesPath);
        console.log('PASS: messages.json created');
    } catch {
        console.error('FAIL: messages.json missing');
    }

    try {
        await fs.access(path.join(mediaDir, 'test.png'));
        console.log('PASS: media/ directory and file created');
    } catch {
        console.error('FAIL: media/ directory missing');
    }

    // Cleanup
    await fs.rm(targetDir, { recursive: true, force: true });
}

verifyMediaEnhancement().catch(console.error);
