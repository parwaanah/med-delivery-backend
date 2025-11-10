// src/cache/cache.service.ts
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { LRUCache } from 'lru-cache'; // ✅ FIXED import (v10+ exports class LRUCache)

export interface CacheGetOptions {
  refreshTTL?: number; // optional: refresh TTL on get
}

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private cache: InstanceType<typeof LRUCache<string, any>>; // ✅ fixed typing

  constructor() {
    // ✅ Updated for lru-cache v10+
    this.cache = new LRUCache<string, any>({
      max: 10_000,
      ttl: 1000 * 60 * 30, // 30 min
      allowStale: false,
    });

    this.logger.log('✅ LRU Cache initialized (v10+ compatible)');
  }

  set<T = any>(key: string, value: T, ttlMs?: number) {
    if (ttlMs && ttlMs > 0) {
      this.cache.set(key, value, { ttl: ttlMs });
    } else {
      this.cache.set(key, value);
    }
  }

  get<T = any>(key: string, opts?: CacheGetOptions): T | undefined {
    const v = this.cache.get(key) as T | undefined;
    if (v && opts?.refreshTTL) {
      this.cache.set(key, v, { ttl: opts.refreshTTL });
    }
    return v;
  }

  del(key: string) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  has(key: string) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  dumpStats() {
    return {
      size: this.cache.size,
      max: (this.cache as any).max ?? null,
    };
  }

  onModuleDestroy() {
    this.logger.log('🧹 Clearing cache on shutdown');
    this.clear();
  }
}
