/**
 * @fileoverview Delay and timing utility functions.
 * @module utils/delay
 */

/**
 * Creates a promise that resolves after a specified delay.
 * @param {number} ms - Delay in milliseconds
 * @returns {Promise<void>} Promise that resolves after the delay
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a promise that resolves after a random delay within a range.
 * Useful for adding jitter to prevent thundering herd problems.
 * @param {number} minMs - Minimum delay in milliseconds
 * @param {number} maxMs - Maximum delay in milliseconds
 * @returns {Promise<void>} Promise that resolves after the random delay
 */
export function randomDelay(minMs, maxMs) {
    const ms = minMs + Math.random() * (maxMs - minMs);
    return delay(ms);
}

/**
 * Creates a timeout promise that rejects after a specified duration.
 * @param {number} ms - Timeout in milliseconds
 * @param {string} [message='Operation timed out'] - Error message
 * @returns {Promise<never>} Promise that rejects after the timeout
 */
export function timeout(ms, message = 'Operation timed out') {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error(message)), ms);
    });
}

/**
 * Wraps a promise with a timeout.
 * @template T
 * @param {Promise<T>} promise - Promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} [message] - Timeout error message
 * @returns {Promise<T>} Promise that resolves with result or rejects on timeout
 */
export function withTimeout(promise, ms, message = 'Operation timed out') {
    return Promise.race([promise, timeout(ms, message)]);
}

export default { delay, randomDelay, timeout, withTimeout };