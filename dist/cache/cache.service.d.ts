import { OnModuleDestroy } from '@nestjs/common';
export interface CacheGetOptions {
    refreshTTL?: number;
}
export declare class CacheService implements OnModuleDestroy {
    private readonly logger;
    private cache;
    constructor();
    set<T = any>(key: string, value: T, ttlMs?: number): void;
    get<T = any>(key: string, opts?: CacheGetOptions): T | undefined;
    del(key: string): void;
    clear(): void;
    has(key: string): boolean;
    size(): number;
    dumpStats(): {
        size: number;
        max: any;
    };
    onModuleDestroy(): void;
}
