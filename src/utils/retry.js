/**
 * @fileoverview Retry mechanism with exponential backoff.
 * Handles transient failures and rate limiting gracefully.
 * @module utils/retry
 */

import { delay } from './delay.js';
import { RetryExhaustedError, RateLimitError } from '../errors/index.js';
import { getLogger } from '../logger/index.js';

/**
 * Default retry options.
 * @type {Object}
 */
const DEFAULT_OPTIONS = {
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    factor: 2,
    jitter: true,
    context: 'operation',
};

/**
 * Calculates the delay for the next retry attempt.
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {Object} options - Retry options
 * @returns {number} Delay in milliseconds
 */
function calculateDelay(attempt, options) {
    let calculatedDelay = options.baseDelay * Math.pow(options.factor, attempt);

    // Apply max delay cap
    calculatedDelay = Math.min(calculatedDelay, options.maxDelay);

    // Add jitter to prevent thundering herd
    if (options.jitter) {
        calculatedDelay += Math.random() * options.baseDelay;
    }

    return Math.floor(calculatedDelay);
}

/**
 * Determines if an error is retryable.
 * @param {Error} error - The error to check
 * @returns {boolean} True if the error is retryable
 */
function isRetryableError(error) {
    // Rate limit errors are always retryable
    if (error instanceof RateLimitError) {
        return true;
    }

    // Discord API specific errors
    if (error.status === 429 || error.httpStatus === 429) {
        return true;
    }

    // Network errors are usually transient
    const retryableMessages = [
        'rate limit',
        'timeout',
        'ECONNRESET',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'socket hang up',
        'network',
        'temporary',
        '5',  // 5xx errors
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return retryableMessages.some(msg => errorMessage.includes(msg.toLowerCase()));
}

/**
 * Executes a function with automatic retries and exponential backoff.
 * 
 * @template T
 * @param {function(): Promise<T>} fn - Async function to execute
 * @param {Object} [options={}] - Retry options
 * @param {number} [options.maxAttempts=5] - Maximum number of attempts
 * @param {number} [options.baseDelay=1000] - Base delay in milliseconds
 * @param {number} [options.maxDelay=30000] - Maximum delay between retries
 * @param {number} [options.factor=2] - Exponential backoff factor
 * @param {boolean} [options.jitter=true] - Add randomness to delays
 * @param {string} [options.context='operation'] - Context for logging
 * @returns {Promise<T>} Result of the function
 * @throws {RetryExhaustedError} When all retry attempts are exhausted
 * 
 * @example
 * const result = await withRetry(
 *     () => channel.messages.fetch({ limit: 100 }),
 *     { context: 'fetching messages', maxAttempts: 3 }
 * );
 */
export async function withRetry(fn, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const logger = getLogger();
    let lastError = null;

    for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Check if this is the last attempt
            if (attempt === opts.maxAttempts - 1) {
                break;
            }

            // Check if error is retryable
            if (!isRetryableError(error)) {
                throw error;
            }

            // Calculate delay, respecting rate limit headers if available
            let retryDelay = calculateDelay(attempt, opts);
            if (error instanceof RateLimitError && error.retryAfter) {
                retryDelay = Math.max(retryDelay, error.retryAfter);
            }

            // Log the retry
            const attemptNum = attempt + 1;
            if (error.status === 429 || error.message?.includes('rate limit')) {
                logger.warn(
                    `Rate limit hit for ${opts.context}. ` +
                    `Retry ${attemptNum}/${opts.maxAttempts} in ${retryDelay}ms`
                );
            } else {
                logger.debug(
                    `${opts.context} failed: ${error.message}. ` +
                    `Retry ${attemptNum}/${opts.maxAttempts} in ${retryDelay}ms`
                );
            }

            await delay(retryDelay);
        }
    }

    // All attempts exhausted
    throw new RetryExhaustedError(
        `Failed to execute ${opts.context} after ${opts.maxAttempts} attempts`,
        opts.maxAttempts,
        lastError,
        { context: opts.context }
    );
}

/**
 * Creates a retry wrapper with pre-configured options.
 * 
 * @param {Object} defaultOptions - Default options for the wrapper
 * @returns {function(function, Object): Promise} Configured retry function
 * 
 * @example
 * const discordRetry = createRetryWrapper({ maxAttempts: 3, context: 'Discord API' });
 * const result = await discordRetry(() => fetchMessages());
 */
export function createRetryWrapper(defaultOptions = {}) {
    return (fn, overrideOptions = {}) => {
        return withRetry(fn, { ...defaultOptions, ...overrideOptions });
    };
}

export default { withRetry, createRetryWrapper };