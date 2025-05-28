import * as vscode from 'vscode';
import systeminfo = require('systeminformation');

export interface CachedData {
    timestamp: number;
    data: any;
}

export interface SystemData {
    cpu?: { currentLoad: any; cpu: any };
    memory?: any;
    gpu?: any;
    uptime?: systeminfo.Systeminformation.TimeData;
    docker?: { containers: any[] };
    network?: { stats: any[]; interfaces: any };
}

export interface ModuleConfig {
    cpu: boolean;
    memory: boolean;
    gpu: boolean;
    uptime: boolean;
    docker: boolean;
    network: boolean;
}

export interface DisplayConfig {
    moduleOrder: string[];
    decimalPlaces: number;
    memoryUnit: 'GB' | 'MB' | 'auto';
    compactMode: boolean;
    showIcons: boolean;
    alignment: 'left' | 'right';
}

export interface ThresholdConfig {
    cpuWarning: number;
    memoryWarning: number;
    enableWarningColors: boolean;
}
