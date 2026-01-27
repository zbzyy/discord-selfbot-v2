/**
 * @fileoverview Custom error classes for the Discord automation suite.
 * Provides type-specific errors for better error handling and logging.
 * @module errors
 */

/**
 * Base application error with context support.
 * @extends Error
 */
export class AppError extends Error {
    /**
     * Creates an AppError instance.
     * @param {string} message - Error message
     * @param {Object} [context={}] - Additional context data
     */
    constructor(message, context = {}) {
        super(message);
        this.name = 'AppError';
        this.context = context;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Returns a formatted string representation of the error.
     * @returns {string} Formatted error string
     */
    toLogString() {
        const contextStr = Object.keys(this.context).length > 0
            ? ` | Context: ${JSON.stringify(this.context)}`
            : '';
        return `[${this.name}] ${this.message}${contextStr}`;
    }
}

/**
 * Error thrown when configuration is invalid or missing.
 * @extends AppError
 */
export class ConfigurationError extends AppError {
    /**
     * Creates a ConfigurationError instance.
     * @param {string} message - Error message
     * @param {Object} [context={}] - Additional context
     */
    constructor(message, context = {}) {
        super(message, context);
        this.name = 'ConfigurationError';
    }
}

/**
 * Error thrown when Discord API calls fail.
 * @extends AppError
 */
export class DiscordAPIError extends AppError {
    /**
     * Creates a DiscordAPIError instance.
     * @param {string} message - Error message
     * @param {number} [statusCode] - HTTP status code if available
     * @param {Object} [context={}] - Additional context
     */
    constructor(message, statusCode = null, context = {}) {
        super(message, { ...context, statusCode });
        this.name = 'DiscordAPIError';
        this.statusCode = statusCode;
    }
}

/**
 * Error thrown when rate limit is exceeded.
 * @extends DiscordAPIError
 */
export class RateLimitError extends DiscordAPIError {
    /**
     * Creates a RateLimitError instance.
     * @param {string} message - Error message
     * @param {number} retryAfter - Milliseconds to wait before retry
     * @param {Object} [context={}] - Additional context
     */
    constructor(message, retryAfter = 1000, context = {}) {
        super(message, 429, { ...context, retryAfter });
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
}

/**
 * Error thrown when authorization fails.
 * @extends AppError
 */
export class AuthorizationError extends AppError {
    /**
     * Creates an AuthorizationError instance.
     * @param {string} message - Error message
     * @param {string} [requiredPermission] - Permission that was required
     * @param {Object} [context={}] - Additional context
     */
    constructor(message, requiredPermission = null, context = {}) {
        super(message, { ...context, requiredPermission });
        this.name = 'AuthorizationError';
    }
}

/**
 * Error thrown when input validation fails.
 * @extends AppError
 */
export class ValidationError extends AppError {
    /**
     * Creates a ValidationError instance.
     * @param {string} message - Error message
     * @param {string} [field] - Field that failed validation
     * @param {Object} [context={}] - Additional context
     */
    constructor(message, field = null, context = {}) {
        super(message, { ...context, field });
        this.name = 'ValidationError';
    }
}

/**
 * Error thrown when an operation times out.
 * @extends AppError
 */
export class TimeoutError extends AppError {
    /**
     * Creates a TimeoutError instance.
     * @param {string} message - Error message
     * @param {number} [timeoutMs] - Timeout duration in milliseconds
     * @param {Object} [context={}] - Additional context
     */
    constructor(message, timeoutMs = null, context = {}) {
        super(message, { ...context, timeoutMs });
        this.name = 'TimeoutError';
    }
}

/**
 * Error thrown when maximum retry attempts are exceeded.
 * @extends AppError
 */
export class RetryExhaustedError extends AppError {
    /**
     * Creates a RetryExhaustedError instance.
     * @param {string} message - Error message
     * @param {number} attempts - Number of attempts made
     * @param {Error} [lastError] - The last error that occurred
     * @param {Object} [context={}] - Additional context
     */
    constructor(message, attempts, lastError = null, context = {}) {
        super(message, { ...context, attempts, lastError: lastError?.message });
        this.name = 'RetryExhaustedError';
        this.attempts = attempts;
        this.lastError = lastError;
    }
}

export default {
    AppError,
    ConfigurationError,
    DiscordAPIError,
    RateLimitError,
    AuthorizationError,
    ValidationError,
    TimeoutError,
    RetryExhaustedError,
};