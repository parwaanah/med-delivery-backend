import { RedisService } from './redis.service';
export declare class LockService {
    private readonly redis;
    constructor(redis: RedisService);
    private token;
    acquire(key: string, ttlMs: number): Promise<string | null>;
    release(key: string, token: string): Promise<void>;
    withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>, opts?: {
        waitMs?: number;
        retries?: number;
    }): Promise<T>;
}
