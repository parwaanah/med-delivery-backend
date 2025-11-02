import Redis from 'ioredis';
export declare function checkRedisConnection(redisUrl: string): Promise<Redis>;
export declare function closeRedisConnection(): Promise<void>;
