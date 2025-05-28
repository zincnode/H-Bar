import systeminfo = require('systeminformation');
import { SystemData } from '../types';
import { CacheManager } from './cache';

export class DataFetcher {
    private cacheManager: CacheManager;

    constructor(cacheTTL: number) {
        this.cacheManager = new CacheManager(cacheTTL);
    }

    async fetchSystemData(): Promise<SystemData> {
        const systemData: SystemData = {};

        const promises = [
            this.cacheManager.getCachedData('cpu', async () => {
                const [currentLoad, cpu] = await Promise.all([
                    systeminfo.currentLoad(),
                    systeminfo.cpu()
                ]);
                return { currentLoad, cpu };
            }).then(data => {
                if (data) systemData.cpu = data;
            }).catch(err => console.warn('CPU data fetch failed:', err)),

            this.cacheManager.getCachedData('memory', () => systeminfo.mem())
                .then(data => {
                    if (data) systemData.memory = data;
                }).catch(err => console.warn('Memory data fetch failed:', err)),

            this.cacheManager.getCachedData('gpu', () => systeminfo.graphics())
                .then(data => {
                    if (data) systemData.gpu = data;
                }).catch(err => console.warn('GPU data fetch failed:', err)),

            this.cacheManager.getCachedData('uptime', async () => {
                return await systeminfo.time();
            }).then(data => {
                if (data) {
                    systemData.uptime = data as systeminfo.Systeminformation.TimeData;
                }
            }).catch(err => console.warn('Uptime data fetch failed:', err)),

            this.cacheManager.getCachedData('docker', async () => {
                try {
                    const containers = await systeminfo.dockerContainers();
                    return { containers: Array.isArray(containers) ? containers : [] };
                } catch {
                    return { containers: [] };
                }
            }).then(data => {
                if (data) systemData.docker = data;
            }).catch(err => console.warn('Docker data fetch failed:', err)),

            this.cacheManager.getCachedData('network', async () => {
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

    updateCacheTTL(newTTL: number): void {
        this.cacheManager.updateCacheTTL(newTTL);
    }

    clearCache(): void {
        this.cacheManager.clear();
    }
}