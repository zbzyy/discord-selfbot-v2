
import { initLogger } from '../src/logger/index.js';
import { config } from '../src/config/index.js';

const logger = initLogger(config);

console.log('--- Log Verification ---');
logger.info('Standard Info Log (should have [INF])');
logger.success('Standard Success Log (should have [OK!])');
logger.plain('Plain Log (should NOT have prefix, but have timestamp)');
console.log('------------------------');