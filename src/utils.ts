import systeminfo = require('systeminformation');
import * as os from 'os';

/**
 * Format bytes to human readable string
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 1 for consistency)
 * @returns Formatted string like "1.2 GB"
 */
export function formatBytes(bytes: number, decimals = 1): string {
    if (bytes === 0 || !Number.isFinite(bytes) || bytes < 0) {
        return '0 B';
    }

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // Prevent array index out of bounds
    const sizeIndex = Math.min(i, sizes.length - 1);

    return parseFloat((bytes / Math.pow(k, sizeIndex)).toFixed(dm)) + ' ' + sizes[sizeIndex];
}


/**
 * Initialize systeminformation library for the current platform
 */
export function systeminfoInit(): void {
    try {
        if (os.platform() === 'win32') {
            systeminfo.powerShellStart();
        }
    } catch (error) {
        console.warn('Failed to initialize systeminformation:', error);
    }
}
