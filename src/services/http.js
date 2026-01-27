/**
 * @fileoverview HTTP client with connection pooling and streaming support.
 * Used for media downloads and external API requests.
 * @module services/http
 */

import https from 'https';
import http from 'http';
import { createWriteStream } from 'fs';
import { unlink } from 'fs/promises';
import { withRetry } from '../utils/retry.js';
import { getLogger } from '../logger/index.js';
import { TimeoutError } from '../errors/index.js';

/** Default HTTP request timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 30000;

/** HTTP agent with keep-alive for connection pooling */
const httpAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 10,
    timeout: DEFAULT_TIMEOUT_MS,
});

/** HTTPS agent with keep-alive for connection pooling */
const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 10,
    timeout: DEFAULT_TIMEOUT_MS,
});

/**
 * Gets the appropriate agent for a URL.
 * @private
 * @param {string} url - URL to check
 * @returns {http.Agent|https.Agent} Appropriate agent
 */
function getAgent(url) {
    return url.startsWith('https') ? httpsAgent : httpAgent;
}

/**
 * Makes an HTTP request with custom options.
 * @param {string} url - Request URL
 * @param {Object} [options={}] - Request options
 * @returns {Promise<{statusCode: number, headers: Object, body: string}>} Response
 */
export async function request(url, options = {}) {
    const logger = getLogger();
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        agent: getAgent(url),
        timeout: options.timeout || DEFAULT_TIMEOUT_MS,
    };

    return new Promise((resolve, reject) => {
        const req = httpModule.request(requestOptions, (res) => {
            let body = '';

            res.on('data', (chunk) => {
                body += chunk;
            });

            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body,
                });
            });
        });

        req.on('error', (error) => {
            logger.debug(`HTTP request error: ${error.message}`);
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new TimeoutError(`Request timeout after ${requestOptions.timeout}ms`, requestOptions.timeout));
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

/**
 * Downloads a file from a URL to a local path using streams.
 * @param {string} url - URL to download from
 * @param {string} savePath - Local path to save to
 * @param {Object} [options={}] - Download options
 * @param {number} [options.timeout=30000] - Download timeout in ms
 * @param {boolean} [options.retry=true] - Whether to retry on failure
 * @returns {Promise<void>}
 */
export async function downloadFile(url, savePath, options = {}) {
    const logger = getLogger();
    const timeout = options.timeout || DEFAULT_TIMEOUT_MS;

    const downloadFn = async () => {
        return new Promise((resolve, reject) => {
            const file = createWriteStream(savePath);
            let timeoutId = null;

            const cleanup = async () => {
                clearTimeout(timeoutId);
                file.close();
            };

            const handleError = async (error) => {
                await cleanup();
                try {
                    await unlink(savePath);
                } catch {
                }
                reject(error);
            };

            timeoutId = setTimeout(async () => {
                await handleError(new TimeoutError(`Download timeout after ${timeout}ms`, timeout));
            }, timeout);

            const parsedUrl = new URL(url);
            const httpModule = parsedUrl.protocol === 'https:' ? https : http;

            httpModule.get(url, { agent: getAgent(url) }, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    // Handle redirects
                    const redirectUrl = response.headers.location;
                    if (redirectUrl) {
                        cleanup();
                        downloadFile(redirectUrl, savePath, options)
                            .then(resolve)
                            .catch(reject);
                        return;
                    }
                }

                if (response.statusCode !== 200) {
                    handleError(new Error(`Download failed with status: ${response.statusCode}`));
                    return;
                }

                response.pipe(file);

                file.on('finish', async () => {
                    clearTimeout(timeoutId);
                    file.close();
                    logger.debug(`Downloaded: ${url} -> ${savePath}`);
                    resolve();
                });

                file.on('error', handleError);
            }).on('error', handleError);
        });
    };

    if (options.retry !== false) {
        return withRetry(downloadFn, {
            context: `downloading ${url}`,
            maxAttempts: 3,
        });
    }

    return downloadFn();
}

/**
 * Posts JSON data to a URL.
 * @param {string} url - Request URL
 * @param {Object} data - Data to send
 * @param {Object} [options={}] - Request options
 * @returns {Promise<{statusCode: number, headers: Object, body: string}>} Response
 */
export async function postJson(url, data, options = {}) {
    const body = JSON.stringify(data);
    return request(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            ...options.headers,
        },
        body,
        ...options,
    });
}

export default {
    request,
    downloadFile,
    postJson,
};