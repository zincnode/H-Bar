import * as vscode from 'vscode';
import systeminfo = require('systeminformation');
import * as utils from './utils';

interface CachedData {
    timestamp: number;
    data: any;
}

interface SystemData {
    cpu?: { currentLoad: any; cpu: any };
    memory?: any;
    gpu?: any;
    uptime?: systeminfo.Systeminformation.TimeData;
    docker?: { containers: any[] };
    network?: { stats: any[]; interfaces: any };
}

interface ModuleConfig {
    cpu: boolean;
    memory: boolean;
    gpu: boolean;
    uptime: boolean;
    docker: boolean;
    network: boolean;
}

interface DisplayConfig {
    moduleOrder: string[];
    decimalPlaces: number;
    memoryUnit: 'GB' | 'MB' | 'auto';
    compactMode: boolean;
    showIcons: boolean;
    alignment: 'left' | 'right';
}

interface ThresholdConfig {
    cpuWarning: number;
    memoryWarning: number;
    enableWarningColors: boolean;
}

class HBar {
    private _context!: vscode.ExtensionContext;
    private hBarItems: Map<string, vscode.StatusBarItem> = new Map();
    private updateInterval: NodeJS.Timeout | null = null;
    private cache: Map<string, CachedData> = new Map();
    private isUpdating = false;

    private cacheTTL: number = 2000;
    private updateIntervalMs: number = 1000;
    private moduleConfig: ModuleConfig = {
        cpu: true,
        memory: true,
        gpu: true,
        uptime: true,
        docker: true,
        network: true
    };
    private displayConfig: DisplayConfig = {
        moduleOrder: ['cpu', 'memory', 'gpu', 'uptime', 'docker', 'network'],
        decimalPlaces: 1,
        memoryUnit: 'GB',
        compactMode: false,
        showIcons: true,
        alignment: 'left'
    };
    private thresholdConfig: ThresholdConfig = {
        cpuWarning: 80,
        memoryWarning: 90,
        enableWarningColors: true
    };

    constructor(context: vscode.ExtensionContext) {
        try {
            this._context = context;
            utils.systeminfoInit();

            this.loadConfiguration();
            this.init();

            this._context.subscriptions.push(
                vscode.workspace.onDidChangeConfiguration(e => {
                    if (e.affectsConfiguration('hbar')) {
                        console.log('H-Bar configuration changed');
                        setTimeout(() => {
                            this.onConfigurationChanged();
                        }, 100);
                    }
                })
            );

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

    private loadConfiguration(): void {
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
        this.moduleConfig = {
            cpu: true,
            memory: true,
            gpu: false,
            uptime: false,
            docker: false,
            network: false
        };
        this.displayConfig = {
            moduleOrder: ['cpu', 'memory'],
            decimalPlaces: 1,
            memoryUnit: 'GB',
            compactMode: false,
            showIcons: true,
            alignment: 'left'
        };
        this.thresholdConfig = {
            cpuWarning: 80,
            memoryWarning: 90,
            enableWarningColors: true
        };
    }

    private onConfigurationChanged(): void {
        try {
            console.log('Configuration changed, reloading...');

            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }

            this.loadConfiguration();
            this.recreateStatusBarItems();
            this.startUpdateInterval();

            console.log('Configuration reloaded successfully');
        } catch (error) {
            console.error('Error during configuration change:', error);
            this.startUpdateInterval();
        }
    }

    private recreateStatusBarItems(): void {
        try {
            console.log('Recreating status bar items...');

            const wasVisible = new Map<string, boolean>();
            this.hBarItems.forEach((item, key) => {
                wasVisible.set(key, !!item.text);
            });

            this.hBarItems.forEach(item => {
                try {
                    item.dispose();
                } catch (error) {
                    console.warn('Error disposing status bar item:', error);
                }
            });
            this.hBarItems.clear();

            this.init();

            console.log(`Created ${this.hBarItems.size} status bar items`);
        } catch (error) {
            console.error('Error recreating status bar items:', error);
            this.createFallbackItems();
        }
    }

    private createFallbackItems(): void {
        const fallbackModules = ['cpu', 'mem'];
        const alignment = this.displayConfig.alignment === 'right'
            ? vscode.StatusBarAlignment.Right
            : vscode.StatusBarAlignment.Left;

        fallbackModules.forEach((moduleKey, index) => {
            if (!this.hBarItems.has(moduleKey)) {
                try {
                    const priority = this.displayConfig.alignment === 'right'
                        ? 1000 + index
                        : 100 - index;
                    const item = vscode.window.createStatusBarItem(alignment, priority);
                    this.hBarItems.set(moduleKey, item);
                    this._context.subscriptions.push(item);
                } catch (error) {
                    console.error(`Error creating fallback item ${moduleKey}:`, error);
                }
            }
        });
    }

    private startUpdateInterval(): void {
        try {
            if (this.updateInterval) {
                return;
            }

            console.log(`Starting update interval: ${this.updateIntervalMs}ms`);

            this.updateInterval = setInterval(async () => {
                if (this.isUpdating) return;
                this.isUpdating = true;

                try {
                    const systemData = await this.fetchSystemData();

                    const updatePromises = [];

                    if (this.moduleConfig.cpu && this.hBarItems.has('cpu')) {
                        updatePromises.push(this.safeUpdateItem('cpu', () => this.updateCpuItem(systemData.cpu)));
                    }
                    if (this.moduleConfig.memory && this.hBarItems.has('mem')) {
                        updatePromises.push(this.safeUpdateItem('mem', () => this.updateMemItem(systemData.memory)));
                    }
                    if (this.moduleConfig.uptime && this.hBarItems.has('uptime')) {
                        updatePromises.push(this.safeUpdateItem('uptime', () => this.updateUptimeItem(systemData.uptime)));
                    }
                    if (this.moduleConfig.docker && this.hBarItems.has('docker')) {
                        updatePromises.push(this.safeUpdateItem('docker', () => this.updateDockerItem(systemData.docker)));
                    }
                    if (this.moduleConfig.network && this.hBarItems.has('net')) {
                        updatePromises.push(this.safeUpdateItem('net', () => this.updateNetSpeedItem(systemData.network)));
                    }
                    if (this.moduleConfig.gpu && this.hBarItems.has('gpu')) {
                        updatePromises.push(this.safeUpdateItem('gpu', () => this.updateGpuItem(systemData.gpu)));
                    }

                    await Promise.allSettled(updatePromises);
                } catch (error) {
                    console.error('Error updating system data:', error);
                } finally {
                    this.isUpdating = false;
                }
            }, this.updateIntervalMs);
        } catch (error) {
            console.error('Error starting update interval:', error);
        }
    }

    private async safeUpdateItem(itemName: string, updateFunction: () => void): Promise<void> {
        try {
            updateFunction();
        } catch (error) {
            console.error(`Error updating ${itemName} item:`, error);
            const item = this.hBarItems.get(itemName);
            if (item) {
                item.text = `${itemName}: Error`;
                item.tooltip = `Error updating ${itemName} information`;
                item.show();
            }
        }
    }

    private async getCachedData<T>(key: string, fetcher: () => Promise<T>): Promise<T | null> {
        const cached = this.cache.get(key);
        const now = Date.now();

        if (cached && (now - cached.timestamp) < this.cacheTTL) {
            return cached.data as T;
        }

        try {
            const data = await fetcher();
            this.cache.set(key, { timestamp: now, data });
            return data;
        } catch (error) {
            console.warn(`Failed to fetch ${key} data:`, error);
            return cached ? cached.data as T : null;
        }
    }

    private init(): void {
        const alignment = this.displayConfig.alignment === 'right'
            ? vscode.StatusBarAlignment.Right
            : vscode.StatusBarAlignment.Left;

        this.displayConfig.moduleOrder.forEach((moduleName, index) => {
            const moduleKey = this.getModuleKey(moduleName);
            if (moduleKey && this.isModuleEnabled(moduleKey)) {
                let priority: number;
                if (this.displayConfig.alignment === 'right') {
                    priority = 1000 + index;
                } else {
                    priority = 100 - index;
                }

                const item = vscode.window.createStatusBarItem(alignment, priority);
                this.hBarItems.set(moduleKey, item);
                this._context.subscriptions.push(item);

                console.log(`Created ${moduleKey} item with alignment: ${alignment}, priority: ${priority}`);
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

    private isModuleEnabled(moduleKey: string): boolean {
        const configMap: Record<string, keyof ModuleConfig> = {
            'cpu': 'cpu',
            'mem': 'memory',
            'gpu': 'gpu',
            'uptime': 'uptime',
            'docker': 'docker',
            'net': 'network'
        };
        const configKey = configMap[moduleKey];
        return configKey ? this.moduleConfig[configKey] : false;
    }

    private async fetchSystemData(): Promise<SystemData> {
        const systemData: SystemData = {};

        const promises = [
            this.getCachedData('cpu', async () => {
                const [currentLoad, cpu] = await Promise.all([
                    systeminfo.currentLoad(),
                    systeminfo.cpu()
                ]);
                return { currentLoad, cpu };
            }).then(data => {
                if (data) systemData.cpu = data;
            }).catch(err => console.warn('CPU data fetch failed:', err)),

            this.getCachedData('memory', () => systeminfo.mem())
                .then(data => {
                    if (data) systemData.memory = data;
                }).catch(err => console.warn('Memory data fetch failed:', err)),

            this.getCachedData('gpu', () => systeminfo.graphics())
                .then(data => {
                    if (data) systemData.gpu = data;
                }).catch(err => console.warn('GPU data fetch failed:', err)),

            this.getCachedData('uptime', async () => {
                return await systeminfo.time();
            }).then(data => {
                if (data) {
                    systemData.uptime = data as systeminfo.Systeminformation.TimeData;
                }
            }).catch(err => console.warn('Uptime data fetch failed:', err)),

            this.getCachedData('docker', async () => {
                try {
                    const containers = await systeminfo.dockerContainers();
                    return { containers: Array.isArray(containers) ? containers : [] };
                } catch {
                    return { containers: [] };
                }
            }).then(data => {
                if (data) systemData.docker = data;
            }).catch(err => console.warn('Docker data fetch failed:', err)),

            this.getCachedData('network', async () => {
                try {
                    const [stats, interfaces] = await Promise.all([
                        systeminfo.networkStats(),
                        systeminfo.networkInterfaces()
                    ]);
                    return {
                        stats: Array.isArray(stats) ? stats : [],
                        interfaces: Array.isArray(interfaces) ? interfaces : []
                    };
                } catch (error) {
                    console.warn('Network data fetch failed:', error);
                    return { stats: [], interfaces: [] };
                }
            }).then(data => {
                if (data) systemData.network = data;
            }).catch(err => console.warn('Network data processing failed:', err))
        ];

        await Promise.allSettled(promises);
        return systemData;
    }

    private updateCpuItem(cpuData: SystemData['cpu']): void {
        const cpuItem = this.hBarItems.get('cpu');
        if (!cpuItem) return;

        if (!cpuData?.currentLoad) {
            cpuItem.hide();
            return;
        }

        const { currentLoad, cpu } = cpuData;
        const usage = this.safeNumber(currentLoad.currentLoad, 0);
        const isWarning = usage > this.thresholdConfig.cpuWarning;

        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`## 🔧 CPU Information\n\n`);
        tooltip.appendMarkdown(`**Processor:** ${cpu?.manufacturer || 'Unknown'} ${cpu?.brand || 'Unknown'}\n\n`);
        tooltip.appendMarkdown(`**Specifications:**\n`);
        tooltip.appendMarkdown(`• **Base Speed:** ${cpu?.speed || 'Unknown'} GHz\n`);
        tooltip.appendMarkdown(`• **Physical Cores:** ${cpu?.physicalCores || 'Unknown'}\n`);
        tooltip.appendMarkdown(`• **Logical Cores:** ${cpu?.cores || 'Unknown'}\n\n`);
        tooltip.appendMarkdown(`**Current Usage:** \`${usage.toFixed(this.displayConfig.decimalPlaces)}%\`\n`);

        const iconText = this.displayConfig.showIcons ? '$(dashboard) ' : '';
        cpuItem.text = `${iconText}${usage.toFixed(this.displayConfig.decimalPlaces)}%`;
        cpuItem.tooltip = tooltip;

        if (this.thresholdConfig.enableWarningColors && isWarning) {
            cpuItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        } else {
            cpuItem.color = undefined;
        }

        cpuItem.show();
    }

    private updateMemItem(memData: SystemData['memory']): void {
        const memItem = this.hBarItems.get('mem');
        if (!memItem) return;

        if (!memData) {
            memItem.hide();
            return;
        }

        const totalMem = this.safeNumber(memData.total, 0);
        const usedMem = this.safeNumber(memData.active || memData.used, 0);
        const usagePercent = totalMem > 0 ? (usedMem / totalMem) * 100 : 0;
        const isWarning = usagePercent > this.thresholdConfig.memoryWarning;

        const usedFormatted = this.formatMemory(usedMem);
        const totalFormatted = this.formatMemory(totalMem);

        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`## 💾 Memory Information\n\n`);
        tooltip.appendMarkdown(`**Usage Overview:**\n`);
        tooltip.appendMarkdown(`• **Used:** ${usedFormatted}\n`);
        tooltip.appendMarkdown(`• **Total:** ${totalFormatted}\n`);
        tooltip.appendMarkdown(`• **Available:** ${this.formatMemory(totalMem - usedMem)}\n\n`);

        const progressBar = this.createProgressBar(usagePercent);
        tooltip.appendMarkdown(`**Usage:** \`${usagePercent.toFixed(this.displayConfig.decimalPlaces)}%\`\n\n`);
        tooltip.appendMarkdown(`${progressBar}\n`);

        const iconText = this.displayConfig.showIcons ? '$(database) ' : '';
        const displayText = `${usedFormatted}/${totalFormatted}`;

        memItem.text = `${iconText}${displayText}`;
        memItem.tooltip = tooltip;

        if (this.thresholdConfig.enableWarningColors && isWarning) {
            memItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        } else {
            memItem.color = undefined;
        }

        memItem.show();
    }

    private updateUptimeItem(timeData: SystemData['uptime']): void {
        const uptimeItem = this.hBarItems.get('uptime');
        if (!uptimeItem) return;

        if (!timeData) {
            uptimeItem.hide();
            return;
        }

        const uptime = this.safeNumber(timeData.uptime, 0);
        const { days, hours, minutes, seconds } = this.parseUptime(uptime);

        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`## ⏰ System Uptime\n\n`);
        tooltip.appendMarkdown(`**Total Uptime:** \`${days}d ${hours}h ${minutes}m ${seconds}s\`\n\n`);
        tooltip.appendMarkdown(`**Breakdown:**\n`);
        tooltip.appendMarkdown(`• **Days:** ${days}\n`);
        tooltip.appendMarkdown(`• **Hours:** ${hours}\n`);
        tooltip.appendMarkdown(`• **Minutes:** ${minutes}\n`);
        tooltip.appendMarkdown(`• **Seconds:** ${seconds}\n`);

        const iconText = this.displayConfig.showIcons ? '$(clock) ' : '';
        const displayTime = this.displayConfig.compactMode
            ? `${days}:${this.pad(hours)}:${this.pad(minutes)}`
            : `${days}d ${hours}h ${minutes}m`;

        uptimeItem.text = `${iconText}${displayTime}`;
        uptimeItem.tooltip = tooltip;
        uptimeItem.show();
    }

    private updateDockerItem(dockerData: SystemData['docker']): void {
        const dockerItem = this.hBarItems.get('docker');
        if (!dockerItem) return;

        const iconText = this.displayConfig.showIcons ? '$(vm) ' : '';

        if (!dockerData || !Array.isArray(dockerData.containers)) {
            dockerItem.text = `${iconText}N/A`;
            dockerItem.tooltip = this.createErrorTooltip('Docker', 'Unable to fetch Docker information', 'Docker may not be installed or running');
            dockerItem.show();
            return;
        }

        const { containers } = dockerData;
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`## 🐳 Docker Containers\n\n`);

        if (containers.length === 0) {
            tooltip.appendMarkdown(`📦 **No containers found**\n\n`);
            tooltip.appendMarkdown(`*Start a container to see it here*\n`);
            dockerItem.text = `${iconText}0`;
        } else {
            const runningCount = containers.filter(c => c.state === 'running').length;
            const stoppedCount = containers.length - runningCount;

            tooltip.appendMarkdown(`**Summary:** ${containers.length} total containers\n`);
            tooltip.appendMarkdown(`• 🟢 **Running:** ${runningCount}\n`);
            if (stoppedCount > 0) {
                tooltip.appendMarkdown(`• 🔴 **Stopped:** ${stoppedCount}\n`);
            }
            tooltip.appendMarkdown(`\n`);

            this.appendContainerDetails(tooltip, containers);
            dockerItem.text = `${iconText}${containers.length}`;
        }

        dockerItem.tooltip = tooltip;
        dockerItem.show();
    }

    private updateNetSpeedItem(netData: SystemData['network']): void {
        const netItem = this.hBarItems.get('net');
        if (!netItem) return;

        if (!netData?.stats || !Array.isArray(netData.stats)) {
            netItem.hide();
            return;
        }

        const { stats, interfaces } = netData;
        const totalUp = stats.reduce((sum, net) => sum + this.safeNumber(net.tx_sec, 0), 0);
        const totalDown = stats.reduce((sum, net) => sum + this.safeNumber(net.rx_sec, 0), 0);

        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`## 🌐 Network Information\n\n`);
        tooltip.appendMarkdown(`**Current Traffic:**\n`);
        tooltip.appendMarkdown(`• 📤 **Upload:** \`${utils.formatBytes(totalUp)}/s\`\n`);
        tooltip.appendMarkdown(`• 📥 **Download:** \`${utils.formatBytes(totalDown)}/s\`\n\n`);

        this.appendInterfaceDetails(tooltip, interfaces);

        const upIcon = this.displayConfig.showIcons ? '$(arrow-up) ' : '↑';
        const downIcon = this.displayConfig.showIcons ? '$(arrow-down) ' : '↓';

        netItem.text = `${upIcon}${utils.formatBytes(totalUp)}/s ${downIcon}${utils.formatBytes(totalDown)}/s`;
        netItem.tooltip = tooltip;
        netItem.show();
    }

    private updateGpuItem(gpuData: SystemData['gpu']): void {
        const gpuItem = this.hBarItems.get('gpu');
        if (!gpuItem) return;

        if (!gpuData?.controllers?.length) {
            gpuItem.hide();
            return;
        }

        const { controllers } = gpuData;
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`## 🚀 GPU Information\n\n`);
        tooltip.appendMarkdown(`**Detected GPUs:** ${controllers.length}\n\n`);

        controllers.forEach((gpu: any, index: number) => {
            this.appendGpuDetails(tooltip, gpu, index);
            if (index < controllers.length - 1) {
                tooltip.appendMarkdown(`\n`);
            }
        });

        const hasVramInfo = controllers.some((gpu: any) =>
            (gpu.vram && gpu.vram > 0) || (gpu.memoryTotal && gpu.memoryTotal > 0)
        );

        if (!hasVramInfo) {
            tooltip.appendMarkdown(`\n---\n\n`);
            tooltip.appendMarkdown(`*⚠️ VRAM information may require elevated privileges or specific drivers*\n`);
        }

        const iconText = this.displayConfig.showIcons ? '$(circuit-board) ' : '';
        gpuItem.text = `${iconText}${controllers.length} GPU${controllers.length > 1 ? 's' : ''}`;
        gpuItem.tooltip = tooltip;
        gpuItem.show();
    }

    private formatMemory(bytes: number): string {
        if (!this.safeNumber(bytes, 0)) return '0B';

        const gb = bytes / (1024 ** 3);
        const mb = bytes / (1024 ** 2);

        switch (this.displayConfig.memoryUnit) {
            case 'MB':
                return `${mb.toFixed(this.displayConfig.decimalPlaces)}MB`;
            case 'auto':
                return gb >= 1
                    ? `${gb.toFixed(this.displayConfig.decimalPlaces)}GB`
                    : `${mb.toFixed(this.displayConfig.decimalPlaces)}MB`;
            case 'GB':
            default:
                return `${gb.toFixed(this.displayConfig.decimalPlaces)}GB`;
        }
    }

    private safeNumber(value: any, fallback: number): number {
        return (typeof value === 'number' && !isNaN(value) && isFinite(value)) ? value : fallback;
    }

    private parseUptime(uptime: number): { days: number; hours: number; minutes: number; seconds: number } {
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor(((uptime % 86400) % 3600) / 60);
        const seconds = Math.floor(((uptime % 86400) % 3600) % 60);
        return { days, hours, minutes, seconds };
    }

    private pad(num: number): string {
        return num.toString().padStart(2, '0');
    }

    private createErrorTooltip(title: string, message: string, note: string): vscode.MarkdownString {
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`## ${title} Status\n\n`);
        tooltip.appendMarkdown(`❌ **${message}**\n\n`);
        tooltip.appendMarkdown(`*${note}*`);
        return tooltip;
    }

    private appendContainerDetails(tooltip: vscode.MarkdownString, containers: any[]): void {
        const maxShow = 5;
        const containersToShow = containers.slice(0, maxShow);

        if (containersToShow.length > 0) {
            tooltip.appendMarkdown(`**Container Details:**\n\n`);
            containersToShow.forEach((container) => {
                const statusIcon = container.state === 'running' ? '🟢' : '🔴';
                const status = container.state?.charAt(0).toUpperCase() + container.state?.slice(1) || 'Unknown';
                tooltip.appendMarkdown(`${statusIcon} **${container.name || 'Unknown'}** - \`${status}\`\n`);
            });

            if (containers.length > maxShow) {
                tooltip.appendMarkdown(`\n*...and ${containers.length - maxShow} more containers*\n`);
            }
        }
    }

    private appendInterfaceDetails(tooltip: vscode.MarkdownString, interfaces: any): void {
        const interfaceArray = Array.isArray(interfaces) ? interfaces : [interfaces].filter(Boolean);
        const activeInterfaces = interfaceArray.filter(net => net.operstate === 'up' || net.operstate === 'unknown');

        if (activeInterfaces.length > 0) {
            tooltip.appendMarkdown(`**Active Interfaces:**\n\n`);
            activeInterfaces.slice(0, 3).forEach((net) => {
                const statusIcon = net.operstate === 'up' ? '🟢' : '🟡';
                tooltip.appendMarkdown(`${statusIcon} **${net.iface || 'Unknown'}**\n`);
                if (net.ip4) {
                    tooltip.appendMarkdown(`   📍 IP: \`${net.ip4}\`\n`);
                }
                if (net.type) {
                    tooltip.appendMarkdown(`   🔗 Type: ${net.type}\n`);
                }
                tooltip.appendMarkdown(`\n`);
            });
        }
    }

    private appendGpuDetails(tooltip: vscode.MarkdownString, gpu: any, index: number): void {
        const vendor = gpu.vendor || 'Unknown';
        const model = gpu.model || 'Unknown Model';

        let vramDisplay = 'N/A';
        if (gpu.vram && gpu.vram > 0) {
            vramDisplay = `${(gpu.vram / 1024).toFixed(1)} GB`;
        } else if (gpu.memoryTotal && gpu.memoryTotal > 0) {
            vramDisplay = `${(gpu.memoryTotal / 1024).toFixed(1)} GB`;
        } else if (gpu.vramDynamic !== undefined) {
            vramDisplay = gpu.vramDynamic ? 'Dynamic' : 'Fixed (Size Unknown)';
        } else {
            vramDisplay = 'Unknown';
        }

        tooltip.appendMarkdown(`**GPU ${index + 1}:**\n`);
        tooltip.appendMarkdown(`• **Vendor:** ${vendor}\n`);
        tooltip.appendMarkdown(`• **Model:** ${model}\n`);
        tooltip.appendMarkdown(`• **VRAM:** \`${vramDisplay}\`\n`);

        if (gpu.bus) {
            tooltip.appendMarkdown(`• **Bus:** ${gpu.bus}\n`);
        }
        if (gpu.subVendor && gpu.subVendor !== vendor) {
            tooltip.appendMarkdown(`• **Sub Vendor:** ${gpu.subVendor}\n`);
        }
    }

    private createProgressBar(percentage: number, length: number = 20): string {
        const safePercentage = Math.max(0, Math.min(100, this.safeNumber(percentage, 0)));
        const filled = Math.round((safePercentage / 100) * length);
        const empty = length - filled;
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        return `\`${bar}\` ${safePercentage.toFixed(this.displayConfig.decimalPlaces)}%`;
    }

    dispose(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.cache.clear();
        this.hBarItems.forEach(item => item.dispose());
        this.hBarItems.clear();
    }
}

export { HBar };
