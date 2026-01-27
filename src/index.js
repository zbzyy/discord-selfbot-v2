/**
 * @fileoverview Application entry point.
 * Initializes the Discord Automation Suite.
 * 
 * @warning SECURITY RISK: This application uses discord.js-selfbot-v13 which
 * violates Discord's Terms of Service. Self-bot usage may result in account
 * termination. Use at your own risk.
 * 
 * @warning TOKENS: Ensure your tokens are stored in a .env file, never in source code.
 * See .env.example for the required environment variables.
 * 
 * @module index
 */

import { Orchestrator } from './orchestrator.js';
import { checkForUpdates } from './utils/updater.js';

process.removeAllListeners('warning');
process.on('warning', (warning) => {
    if (warning.message?.includes('ready event has been renamed')) return;
    console.warn(warning);
});

async function main() {
    await checkForUpdates();
    const orchestrator = new Orchestrator();
    await orchestrator.start();
}

main().catch((error) => {
    console.error('\n  ✗ Fatal error:', error.message);
    process.exit(1);
});