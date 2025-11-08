// src/queues/redis.module.ts
import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS',
      useFactory: (config: ConfigService) => {
        const url = config.get('REDIS_URL') || 'redis://127.0.0.1:6379';
        return new IORedis(url, { maxRetriesPerRequest: null });
      },
      inject: [ConfigService],
    },
  ],
  exports: ['REDIS'],
})
export class RedisModule {}
