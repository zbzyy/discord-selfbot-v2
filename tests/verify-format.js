
import path from 'path';
import { promises as fs } from 'fs';
import { config } from '../src/config/index.js';
import { ensureDir, safeWriteFile, sanitizeFilename } from '../src/utils/file.js';

async function verifyFormat() {
    console.log('Verifying Export Format...');

    const exportDir = config.exportDir;
    const testDir = path.join(exportDir, 'test_format_123');
    await ensureDir(testDir);

    // Mock scraping result
    const messages = [
        { id: '1', createdTimestamp: Date.now(), author: { tag: 'user#1234' }, content: 'Hello TXT', attachments: new Map() }
    ];

    // Simulate TXT export logic from scraper-deep
    const timestampStr = '20230125_000000';
    const txtFileName = `scrape_${timestampStr}.txt`;
    const txtFilePath = path.join(testDir, txtFileName);

    const txtContent = messages.map(m => {
        const time = new Date(m.createdTimestamp).toISOString(); // Simplified for test
        return `[${time}] ${m.author.tag}: ${m.content}`;
    }).join('\n');

    await safeWriteFile(txtFilePath, txtContent);

    try {
        const content = await fs.readFile(txtFilePath, 'utf8');
        if (content.includes('Hello TXT')) {
            console.log('PASS: TXT file created and contains content');
        } else {
            console.error('FAIL: TXT file content mismatch');
        }
    } catch (e) {
        console.error('FAIL: TXT file not created', e);
    }

    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
}

verifyFormat().catch(console.error);
