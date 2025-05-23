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
 * Format Unix timestamp to readable date string
 * @param unixTime - Unix timestamp
 * @returns Formatted string like "2024-05-23 14:30:25"
 */
export function formatTime(unixTime: number): string {
    if (!Number.isFinite(unixTime)) {
        return 'Invalid Date';
    }

    const date = new Date(unixTime * 1000);

    if (isNaN(date.getTime())) {
        return 'Invalid Date';
    }

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    const second = date.getSeconds().toString().padStart(2, '0');

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
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
