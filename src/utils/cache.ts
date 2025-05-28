import { CachedData } from '../types';

export class CacheManager {
    private cache: Map<string, CachedData> = new Map();
    private cacheTTL: number;

    constructor(cacheTTL: number) {
        this.cacheTTL = cacheTTL;
    }

    async getCachedData<T>(key: string, fetcher: () => Promise<T>): Promise<T | null> {
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

    updateCacheTTL(newTTL: number): void {
        this.cacheTTL = newTTL;
    }

    clear(): void {
        this.cache.clear();
    }
}