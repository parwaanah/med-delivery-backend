import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class CacheService implements OnModuleInit {
    private config;
    private client;
    private readonly logger;
    constructor(config: ConfigService);
    onModuleInit(): void;
    get<T = any>(key: string): Promise<T | null>;
    set(key: string, value: any, ttlSec?: number): Promise<void>;
    del(key: string): Promise<void>;
}
