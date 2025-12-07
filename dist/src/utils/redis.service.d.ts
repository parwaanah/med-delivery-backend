import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RedisClientType } from 'redis';
export declare class RedisService implements OnModuleInit, OnModuleDestroy {
    client: RedisClientType;
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
}
