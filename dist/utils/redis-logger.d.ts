import IORedis from 'ioredis';
export declare function checkRedisConnection(redisUrl: string): Promise<IORedis>;
export declare function redisPing(redisUrl?: string): Promise<boolean>;
export declare function closeRedisConnection(): Promise<void>;
