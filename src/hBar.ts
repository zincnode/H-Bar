import * as vscode from 'vscode';
import { BaseModule } from './modules/base';
import { CpuModule } from './modules/cpu';
import { MemoryModule } from './modules/memory';
import { GpuModule } from './modules/gpu';
import { UptimeModule } from './modules/uptime';
import { DockerModule } from './modules/docker';
import { NetworkModule } from './modules/network';
import { ConfigManager } from './config/manager';
import { DataFetcher } from './utils/dataFetcher';
import { ModuleConfig } from './types';
import * as utils from './utils';

export class HBar {
    private context!: vscode.ExtensionContext;
    private configManager!: ConfigManager;
    private dataFetcher!: DataFetcher;
    private modules: Map<string, BaseModule> = new Map();
    private updateInterval: NodeJS.Timeout | null = null;
    private isUpdating = false;

    constructor(context: vscode.ExtensionContext) {
        try {
            this.context = context;
            utils.systeminfoInit();

            this.configManager = new ConfigManager();
            this.dataFetcher = new DataFetcher(this.configManager.getCacheTTL());

            this.init();
            this.setupConfigurationWatcher();

            console.log('H-Bar initialized successfully');
        } catch (error) {
            console.error('Error initializing H-Bar:', error);
            vscode.window.showErrorMessage(`H-Bar initialization failed: ${error}`);
        }
    }

    async update(): Promise<void> {
        try {
            console.log('Starting H-Bar updates...');
            this.startUpdateInterval();
        } catch (error) {
            console.error('Error starting H-Bar updates:', error);
        }
    }

    private init(): void {
        this.createModules();
        this.startUpdateInterval();
    }

    private createModules(): void {
        const moduleConfig = this.configManager.getModuleConfig();
        const displayConfig = this.configManager.getDisplayConfig();
        const thresholdConfig = this.configManager.getThresholdConfig();

        const alignment = displayConfig.alignment === 'right'
            ? vscode.StatusBarAlignment.Right
            : vscode.StatusBarAlignment.Left;

        displayConfig.moduleOrder.forEach((moduleName, index) => {
            if (!this.isModuleEnabled(moduleName, moduleConfig)) return;

            const priority = displayConfig.alignment === 'right'
                ? 1000 + index
                : 100 - index;

            const statusBarItem = vscode.window.createStatusBarItem(alignment, priority);
            this.context.subscriptions.push(statusBarItem);

            let module: BaseModule | null = null;
            const moduleKey = this.getModuleKey(moduleName);

            switch (moduleName) {
                case 'cpu':
                    module = new CpuModule(statusBarItem, displayConfig, thresholdConfig);
                    break;
                case 'memory':
                    module = new MemoryModule(statusBarItem, displayConfig, thresholdConfig);
                    break;
                case 'gpu':
                    module = new GpuModule(statusBarItem, displayConfig, thresholdConfig);
                    break;
                case 'uptime':
                    module = new UptimeModule(statusBarItem, displayConfig, thresholdConfig);
                    break;
                case 'docker':
                    module = new DockerModule(statusBarItem, displayConfig, thresholdConfig);
                    break;
                case 'network':
                    module = new NetworkModule(statusBarItem, displayConfig, thresholdConfig);
                    break;
            }

            if (module && moduleKey) {
                this.modules.set(moduleKey, module);
                console.log(`Created ${moduleKey} module with alignment: ${alignment}, priority: ${priority}`);
            }
        });
    }

    private getModuleKey(moduleName: string): string | null {
        const moduleMap: Record<string, string> = {
            'cpu': 'cpu',
            'memory': 'mem',
            'gpu': 'gpu',
            'uptime': 'uptime',
            'docker': 'docker',
            'network': 'net'
        };
        return moduleMap[moduleName] || null;
    }

    private isModuleEnabled(moduleName: string, moduleConfig: ModuleConfig): boolean {
        return moduleConfig[moduleName as keyof ModuleConfig] || false;
    }

    private startUpdateInterval(): void {
        try {
            if (this.updateInterval) {
                return;
            }

            console.log(`Starting update interval: ${this.configManager.getUpdateInterval()}ms`);

            this.updateInterval = setInterval(async () => {
                if (this.isUpdating) return;
                this.isUpdating = true;

                try {
                    const systemData = await this.dataFetcher.fetchSystemData();

                    const updatePromises = [];

                    for (const [moduleKey, module] of this.modules) {
                        updatePromises.push(this.safeUpdateModule(moduleKey, module, systemData));
                    }

                    await Promise.allSettled(updatePromises);
                } catch (error) {
                    console.error('Error in update cycle:', error);
                } finally {
                    this.isUpdating = false;
                }
            }, this.configManager.getUpdateInterval());
        } catch (error) {
            console.error('Error starting update interval:', error);
        }
    }

    private async safeUpdateModule(moduleKey: string, module: BaseModule, systemData: any): Promise<void> {
        try {
            const dataKey = this.getDataKey(moduleKey);
            const data = systemData[dataKey];
            module.update(data);
        } catch (error) {
            console.error(`Error updating ${moduleKey} module:`, error);
        }
    }

    private getDataKey(moduleKey: string): string {
        const dataMap: Record<string, string> = {
            'cpu': 'cpu',
            'mem': 'memory',
            'gpu': 'gpu',
            'uptime': 'uptime',
            'docker': 'docker',
            'net': 'network'
        };
        return dataMap[moduleKey] || moduleKey;
    }

    private setupConfigurationWatcher(): void {
        this.context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('hbar')) {
                    console.log('H-Bar configuration changed');
                    setTimeout(() => {
                        this.onConfigurationChanged();
                    }, 100);
                }
            })
        );
    }

    private onConfigurationChanged(): void {
        try {
            console.log('Configuration changed, reloading...');

            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }

            this.configManager.loadConfiguration();
            this.dataFetcher.updateCacheTTL(this.configManager.getCacheTTL());
            this.recreateModules();

            console.log('Configuration reloaded successfully');
        } catch (error) {
            console.error('Error during configuration change:', error);
            this.startUpdateInterval();
        }
    }

    private recreateModules(): void {
        try {
            console.log('Recreating modules...');

            this.modules.forEach(module => module.dispose());
            this.modules.clear();

            this.createModules();
            this.startUpdateInterval();

            console.log(`Created ${this.modules.size} modules`);
        } catch (error) {
            console.error('Error recreating modules:', error);
        }
    }

    dispose(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        this.modules.forEach(module => module.dispose());
        this.modules.clear();
        this.dataFetcher.clearCache();
    }
}