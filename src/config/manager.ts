import * as vscode from 'vscode';
import { ModuleConfig, DisplayConfig, ThresholdConfig } from '../types';

export class ConfigManager {
    private updateIntervalMs: number = 1000;
    private cacheTTL: number = 2000;
    private moduleConfig: ModuleConfig;
    private displayConfig: DisplayConfig;
    private thresholdConfig: ThresholdConfig;

    constructor() {
        this.moduleConfig = this.getDefaultModuleConfig();
        this.displayConfig = this.getDefaultDisplayConfig();
        this.thresholdConfig = this.getDefaultThresholdConfig();
        this.loadConfiguration();
    }

    loadConfiguration(): void {
        try {
            const config = vscode.workspace.getConfiguration('hbar');
            console.log('Loading configuration...');

            const rawUpdateInterval = config.get<number>('updateInterval', 1000);
            const rawCacheTTL = config.get<number>('cacheTTL', 2000);

            this.updateIntervalMs = Math.max(500, Math.min(10000, rawUpdateInterval));
            this.cacheTTL = Math.max(500, Math.min(30000, rawCacheTTL));

            this.moduleConfig = {
                cpu: config.get<boolean>('modules.cpu') ?? true,
                memory: config.get<boolean>('modules.memory') ?? true,
                gpu: config.get<boolean>('modules.gpu') ?? true,
                uptime: config.get<boolean>('modules.uptime') ?? true,
                docker: config.get<boolean>('modules.docker') ?? true,
                network: config.get<boolean>('modules.network') ?? true
            };

            const rawModuleOrder = config.get<string[]>('display.moduleOrder', ['cpu', 'memory', 'gpu', 'uptime', 'docker', 'network']);
            const validModules = ['cpu', 'memory', 'gpu', 'uptime', 'docker', 'network'];
            const moduleOrder = rawModuleOrder.filter(module => validModules.includes(module));

            if (moduleOrder.length === 0) {
                moduleOrder.push(...validModules);
            }

            this.displayConfig = {
                moduleOrder,
                decimalPlaces: Math.max(0, Math.min(3, config.get<number>('display.decimalPlaces', 1))),
                memoryUnit: config.get<'GB' | 'MB' | 'auto'>('display.memoryUnit', 'GB'),
                compactMode: config.get<boolean>('display.compactMode') ?? false,
                showIcons: config.get<boolean>('display.showIcons') ?? true,
                alignment: config.get<'left' | 'right'>('display.alignment', 'left')
            };

            this.thresholdConfig = {
                cpuWarning: Math.max(0, Math.min(100, config.get<number>('thresholds.cpuWarning', 80))),
                memoryWarning: Math.max(0, Math.min(100, config.get<number>('thresholds.memoryWarning', 90))),
                enableWarningColors: config.get<boolean>('colors.enableWarningColors') ?? true
            };

            console.log('Configuration loaded successfully:', {
                updateInterval: this.updateIntervalMs,
                enabledModules: Object.entries(this.moduleConfig).filter(([, enabled]) => enabled).map(([name]) => name),
                moduleOrder: this.displayConfig.moduleOrder,
                alignment: this.displayConfig.alignment
            });
        } catch (error) {
            console.error('Error loading configuration:', error);
            this.loadDefaultConfiguration();
        }
    }

    private loadDefaultConfiguration(): void {
        console.log('Loading default configuration...');
        this.updateIntervalMs = 1000;
        this.cacheTTL = 2000;
        this.moduleConfig = this.getDefaultModuleConfig();
        this.displayConfig = this.getDefaultDisplayConfig();
        this.thresholdConfig = this.getDefaultThresholdConfig();
    }

    private getDefaultModuleConfig(): ModuleConfig {
        return {
            cpu: true,
            memory: true,
            gpu: false,
            uptime: false,
            docker: false,
            network: false
        };
    }

    private getDefaultDisplayConfig(): DisplayConfig {
        return {
            moduleOrder: ['cpu', 'memory'],
            decimalPlaces: 1,
            memoryUnit: 'GB',
            compactMode: false,
            showIcons: true,
            alignment: 'left'
        };
    }

    private getDefaultThresholdConfig(): ThresholdConfig {
        return {
            cpuWarning: 80,
            memoryWarning: 90,
            enableWarningColors: true
        };
    }

    getUpdateInterval(): number { return this.updateIntervalMs; }
    getCacheTTL(): number { return this.cacheTTL; }
    getModuleConfig(): ModuleConfig { return this.moduleConfig; }
    getDisplayConfig(): DisplayConfig { return this.displayConfig; }
    getThresholdConfig(): ThresholdConfig { return this.thresholdConfig; }
}