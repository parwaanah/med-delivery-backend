// src/utils/redis.service.ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  public client!: RedisClientType; // <-- FIXED (!)

  async onModuleInit() {
    const url =
      process.env.REDIS_URL ||
      `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || '6379'}`;

    this.client = createClient({ url });

    this.client.on('error', (err) => {
      console.error('❌ Redis Client Error:', err);
    });

    await this.client.connect();

    console.log(`✅ RedisService connected → ${url}`);
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
    } catch {}
  }
}
