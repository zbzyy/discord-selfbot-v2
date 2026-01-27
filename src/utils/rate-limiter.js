/**
 * @fileoverview Rate limiter for Discord API calls.
 * Implements token bucket algorithm with per-route limiting.
 * @module utils/rate-limiter
 */

import { delay } from './delay.js';
import { RateLimitError } from '../errors/index.js';
import { getLogger } from '../logger/index.js';

/**
 * Token bucket rate limiter.
 */
class TokenBucket {
    /**
     * Creates a TokenBucket instance.
     * @param {number} capacity - Maximum tokens in the bucket
     * @param {number} refillRate - Tokens added per second
     */
    constructor(capacity, refillRate) {
        this.capacity = capacity;
        this.tokens = capacity;
        this.refillRate = refillRate;
        this.lastRefill = Date.now();
    }

    /**
     * Refills the bucket based on elapsed time.
     * @private
     */
    _refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
        this.lastRefill = now;
    }

    /**
     * Attempts to consume tokens from the bucket.
     * @param {number} [count=1] - Number of tokens to consume
     * @returns {boolean} True if tokens were consumed
     */
    tryConsume(count = 1) {
        this._refill();
        if (this.tokens >= count) {
            this.tokens -= count;
            return true;
        }
        return false;
    }

    /**
     * Gets the time in ms until tokens are available.
     * @param {number} [count=1] - Number of tokens needed
     * @returns {number} Milliseconds until tokens are available
     */
    getWaitTime(count = 1) {
        this._refill();
        if (this.tokens >= count) {
            return 0;
        }
        const tokensNeeded = count - this.tokens;
        return Math.ceil((tokensNeeded / this.refillRate) * 1000);
    }
}

/**
 * Rate limiter for Discord API operations.
 */
export class RateLimiter {
    /**
     * Creates a RateLimiter instance.
     * @param {Object} [options={}] - Rate limiter options
     * @param {number} [options.globalLimit=50] - Global requests per second
     * @param {number} [options.messageLimit=5] - Messages per second per channel
     * @param {number} [options.deleteLimit=5] - Deletes per second
     */
    constructor(options = {}) {
        this.options = {
            globalLimit: options.globalLimit || 50,
            messageLimit: options.messageLimit || 5,
            deleteLimit: options.deleteLimit || 5,
        };

        this.globalBucket = new TokenBucket(this.options.globalLimit, this.options.globalLimit);
        this.routeBuckets = new Map();
        this.logger = getLogger().child('RateLimiter');
    }

    /**
     * Gets or creates a bucket for a specific route.
     * @private
     * @param {string} route - Route identifier
     * @param {number} capacity - Bucket capacity
     * @returns {TokenBucket} Token bucket for the route
     */
    _getBucket(route, capacity) {
        if (!this.routeBuckets.has(route)) {
            this.routeBuckets.set(route, new TokenBucket(capacity, capacity));
        }
        return this.routeBuckets.get(route);
    }

    /**
     * Waits until rate limit allows the operation.
     * @param {string} [route='global'] - Route identifier
     * @param {string} [type='default'] - Operation type
     * @returns {Promise<void>} Resolves when operation can proceed
     */
    async wait(route = 'global', type = 'default') {
        // Check global limit first
        let globalWait = this.globalBucket.getWaitTime();
        if (globalWait > 0) {
            this.logger.debug(`Global rate limit: waiting ${globalWait}ms`);
            await delay(globalWait);
        }
        this.globalBucket.tryConsume();

        // Check route-specific limit
        if (route !== 'global') {
            const capacity = type === 'delete' ? this.options.deleteLimit : this.options.messageLimit;
            const bucket = this._getBucket(route, capacity);
            const routeWait = bucket.getWaitTime();
            if (routeWait > 0) {
                this.logger.debug(`Route ${route} rate limit: waiting ${routeWait}ms`);
                await delay(routeWait);
            }
            bucket.tryConsume();
        }
    }

    /**
     * Wraps an async operation with rate limiting.
     * @template T
     * @param {function(): Promise<T>} fn - Async function to execute
     * @param {string} [route='global'] - Route identifier
     * @param {string} [type='default'] - Operation type
     * @returns {Promise<T>} Result of the function
     */
    async execute(fn, route = 'global', type = 'default') {
        await this.wait(route, type);
        return fn();
    }

    /**
     * Handles a rate limit response from Discord.
     * @param {number} retryAfter - Milliseconds to wait
     * @param {string} [route='global'] - Route that was limited
     */
    async handleRateLimit(retryAfter, route = 'global') {
        this.logger.warn(`Rate limit hit on ${route}, backing off for ${retryAfter}ms`);
        await delay(retryAfter);
    }
}

// Singleton instance
let rateLimiterInstance = null;

/**
 * Gets or creates the rate limiter instance.
 * @param {Object} [options] - Rate limiter options
 * @returns {RateLimiter} Rate limiter instance
 */
export function getRateLimiter(options = {}) {
    if (!rateLimiterInstance) {
        rateLimiterInstance = new RateLimiter(options);
    }
    return rateLimiterInstance;
}

export default { RateLimiter, getRateLimiter };