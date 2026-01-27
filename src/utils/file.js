/**
 * @fileoverview File I/O utilities with safe operations and streaming support.
 * @module utils/file
 */

import { promises as fs, createWriteStream, createReadStream } from 'fs';
import path from 'path';
import { getLogger } from '../logger/index.js';

/**
 * Ensures a directory exists, creating it if necessary.
 * @param {string} dirPath - Directory path to ensure
 * @returns {Promise<void>}
 */
export async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}

/**
 * Safely writes content to a file, creating directories as needed.
 * Logs errors but doesn't throw to prevent crashes on non-critical writes.
 * @param {string} filePath - Target file path
 * @param {string|Buffer} content - Content to write
 * @returns {Promise<boolean>} True if write succeeded
 */
export async function safeWriteFile(filePath, content) {
    const logger = getLogger();
    try {
        await ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, content);
        return true;
    } catch (error) {
        logger.error(`Failed to write file ${filePath}`, error);
        return false;
    }
}

/**
 * Safely appends content to a file.
 * @param {string} filePath - Target file path
 * @param {string} content - Content to append
 * @returns {Promise<boolean>} True if append succeeded
 */
export async function safeAppendFile(filePath, content) {
    const logger = getLogger();
    try {
        await ensureDir(path.dirname(filePath));
        await fs.appendFile(filePath, content);
        return true;
    } catch (error) {
        logger.error(`Failed to append to file ${filePath}`, error);
        return false;
    }
}

/**
 * Checks if a file exists.
 * @param {string} filePath - File path to check
 * @returns {Promise<boolean>} True if file exists
 */
export async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Safely deletes a file if it exists.
 * @param {string} filePath - File path to delete
 * @returns {Promise<boolean>} True if deleted or didn't exist
 */
export async function safeDeleteFile(filePath) {
    try {
        await fs.unlink(filePath);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return true; // File didn't exist
        }
        return false;
    }
}

/**
 * Reads a JSON file and parses it.
 * @param {string} filePath - Path to JSON file
 * @param {*} [defaultValue=null] - Default value if file doesn't exist
 * @returns {Promise<*>} Parsed JSON or default value
 */
export async function readJsonFile(filePath, defaultValue = null) {
    try {
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return defaultValue;
        }
        throw error;
    }
}

/**
 * Writes an object to a JSON file with formatting.
 * @param {string} filePath - Target file path
 * @param {*} data - Data to serialize
 * @param {number} [indent=2] - JSON indentation
 * @returns {Promise<boolean>} True if write succeeded
 */
export async function writeJsonFile(filePath, data, indent = 2) {
    const content = JSON.stringify(data, null, indent);
    return safeWriteFile(filePath, content);
}

/**
 * Sanitizes a filename by removing invalid characters.
 * @param {string} filename - Original filename
 * @param {number} [maxLength=100] - Maximum filename length
 * @returns {string} Sanitized filename
 */
export function sanitizeFilename(filename) {
    return filename
        .replace(/[^a-z0-9._-]/gi, '_')
        .substring(0, 100);
}

/**
 * Creates a write stream for large file operations.
 * @param {string} filePath - Target file path
 * @returns {fs.WriteStream} Write stream
 */
export function createFileWriteStream(filePath) {
    return createWriteStream(filePath);
}

/**
 * Creates a read stream for large file operations.
 * @param {string} filePath - Source file path
 * @returns {fs.ReadStream} Read stream
 */
export function createFileReadStream(filePath) {
    return createReadStream(filePath);
}

/**
 * Gets file stats safely.
 * @param {string} filePath - File path
 * @returns {Promise<fs.Stats|null>} File stats or null
 */
export async function getFileStats(filePath) {
    try {
        return await fs.stat(filePath);
    } catch {
        return null;
    }
}

export default {
    ensureDir,
    safeWriteFile,
    safeAppendFile,
    fileExists,
    safeDeleteFile,
    readJsonFile,
    writeJsonFile,
    sanitizeFilename,
    createFileWriteStream,
    createFileReadStream,
    getFileStats,
};