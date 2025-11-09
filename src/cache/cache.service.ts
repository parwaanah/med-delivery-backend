import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CacheService implements OnModuleInit {
  private client!: Redis;
  private readonly logger = new Logger(CacheService.name);

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get('REDIS_URL') || 'redis://127.0.0.1:6379';
    this.client = new Redis(url);
    this.client.on('connect', () => this.logger.log(`✅ Redis cache connected ${url}`));
    this.client.on('error', (e) => this.logger.warn('Redis cache error', e));
  }

  async get<T = any>(key: string): Promise<T | null> {
    const v = await this.client.get(key);
    return v ? JSON.parse(v) as T : null;
  }

  async set(key: string, value: any, ttlSec = 60) {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSec);
  }

  async del(key: string) {
    await this.client.del(key);
  }
}
