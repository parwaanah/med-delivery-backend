// src/surge/surge.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SurgeLiveGateway } from '../ws/surge-live.gateway';
import Redis from 'ioredis';

interface SurgeSnapshot {
  timestamp: number;
  demand: number;
  supply: number;
  multiplier: number;
}

@Injectable()
export class SurgeService {
  private readonly logger = new Logger('SurgeService');
  private redis!: Redis;
  private readonly windowMs = 15 * 60 * 1000; // 15 min rolling window
  private readonly baseMultiplier = 1.0;
  private currentMultiplier = 1.0;
  private overrideValue: number | null = null;
  private readonly historyKey = 'surge:history';
  private readonly demandKey = 'surge:demand';
  private readonly supplyKey = 'surge:supply';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly surgeGateway: SurgeLiveGateway,
  ) {
    const url = this.config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379';
    this.redis = new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: true });
    this.logger.log(`✅ Predictive Surge Engine connected → ${url}`);

    // auto-clean keys from previous versions if types mismatch
    (async () => {
      const keys = [this.historyKey, this.demandKey, this.supplyKey];
      for (const key of keys) {
        try {
          const type = await this.redis.type(key);
          if (key === this.historyKey && type !== 'zset' && type !== 'none') {
            this.logger.warn(`🧹 Resetting old Redis key: ${key} (was ${type})`);
            await this.redis.del(key);
          }
          if ((key === this.demandKey || key === this.supplyKey) && type !== 'string' && type !== 'none') {
            this.logger.warn(`🧹 Resetting old Redis key: ${key} (was ${type})`);
            await this.redis.del(key);
          }
        } catch (err) {
          this.logger.error(`Redis cleanup failed for ${key}`, err);
        }
      }
    })();
  }

  async incrementDemand(by = 1) {
    await this.redis.incrby(this.demandKey, by);
    return this.recalculate();
  }

  async recordRiderAvailability(riderId: number, available: boolean) {
    await this.redis.incrby(this.supplyKey, available ? 1 : -1);
    return this.recalculate();
  }

  private async recalculate() {
    try {
      if (this.overrideValue) return this.broadcast(this.overrideValue);

      const demand = parseInt((await this.redis.get(this.demandKey)) || '0', 10);
      const supply = Math.max(1, parseInt((await this.redis.get(this.supplyKey)) || '1', 10));

      const snap: SurgeSnapshot = {
        timestamp: Date.now(),
        demand,
        supply,
        multiplier: this.currentMultiplier,
      };

      try {
        await this.redis.zadd(this.historyKey, Date.now(), JSON.stringify(snap));
      } catch (err: any) {
        if (err?.message?.includes('WRONGTYPE')) {
          this.logger.warn(`⚠️ Surge history type mismatch — resetting key '${this.historyKey}'`);
          await this.redis.del(this.historyKey);
          await this.redis.zadd(this.historyKey, Date.now(), JSON.stringify(snap));
        } else {
          throw err;
        }
      }

      await this.trimHistory();

      const minScore = Date.now() - this.windowMs;
      const samples = await this.redis.zrangebyscore(this.historyKey, minScore, '+inf');
      const parsed = samples.map((s) => JSON.parse(s) as SurgeSnapshot);

      const avgDemand = parsed.length > 0 ? parsed.reduce((a, b) => a + b.demand, 0) / parsed.length : demand;
      const avgSupply = parsed.length > 0 ? parsed.reduce((a, b) => a + b.supply, 0) / parsed.length : supply;

      const ratio = avgDemand / avgSupply;
      const smoothFactor = 0.6;
      const targetMult = this.baseMultiplier + Math.max(0, ratio - 1) * 0.75;

      this.currentMultiplier =
        this.currentMultiplier * smoothFactor + targetMult * (1 - smoothFactor);
      this.currentMultiplier = Number(this.currentMultiplier.toFixed(2));

      return this.broadcast(this.currentMultiplier, demand, supply);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('❌ Surge recalc failed', message);
      return { multiplier: this.currentMultiplier, error: message };
    }
  }

  private async trimHistory() {
    const cutoff = Date.now() - this.windowMs;
    await this.redis.zremrangebyscore(this.historyKey, '-inf', cutoff);
  }

  private broadcast(multiplier: number, demand = 0, supply = 0) {
    this.surgeGateway.broadcastSurge({
      multiplier,
      demand,
      supply,
      timestamp: Date.now(),
    });
    this.logger.log(`⚡ Surge update → x${multiplier} (demand ${demand}, supply ${supply})`);
    return { multiplier, demand, supply };
  }

  async overrideMultiplier(multiplier: number, meta?: any) {
    this.overrideValue = multiplier;
    this.logger.warn(`🛠 Surge override → x${multiplier} by ${meta?.setBy ?? 'manual'}`);
    return this.broadcast(multiplier);
  }

  async clearOverride() {
    this.overrideValue = null;
    this.logger.log('🔄 Surge override cleared; resuming predictive mode');
    return this.recalculate();
  }

  async getStatus() {
    const demand = parseInt((await this.redis.get(this.demandKey)) || '0', 10);
    const supply = parseInt((await this.redis.get(this.supplyKey)) || '0', 10);
    return {
      multiplier: this.overrideValue ?? this.currentMultiplier,
      demand,
      supply,
      override: this.overrideValue,
    };
  }
}
