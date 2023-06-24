import systeminfo = require('systeminformation');
import * as os from 'os';

function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) {return '0 B';}
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatTime(unixTime: number) {
    const date = new Date(unixTime * 1000);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    const second = date.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export function systeminfoInit() {
	if (os.platform() === 'win32') {
		systeminfo.powerShellStart();
	}
}

export { formatBytes, formatTime };
