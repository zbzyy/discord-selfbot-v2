/**
 * @fileoverview Version comparison utility.
 * @module utils/version
 */

/**
 * Compares two semantic version strings.
 * @param {string} v1 - First version (keep invalid inputs lower)
 * @param {string} v2 - Second version
 * @returns {number} 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1, v2) {
    if (!v1 || !v2) return 0;

    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;

        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }

    return 0;
}

/**
 * Checks if the remote version is strictly newer than the current version.
 * @param {string} matchVersion - The version to match against (remote)
 * @param {string} currentVersion - The current version (local)
 * @returns {boolean} True if matchVersion > currentVersion
 */
export function isNewerVersion(matchVersion, currentVersion) {
    return compareVersions(matchVersion, currentVersion) === 1;
}
