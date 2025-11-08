// src/geosurge/geo-surge.service.ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { GeoSurgeLiveGateway } from '../ws/geo-surge-live.gateway';

export interface GeoZone {
  id: string;
  lon: number;
  lat: number;
  count: number;
  multiplier: number;
  lastUpdated: number;
}

@Injectable()
export class GeoSurgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('GeoSurgeService');
  private redis!: Redis;
  private readonly key = 'geo:points';
  private readonly calcIntervalMs = 15 * 1000; // recalc every 15s
  private interval?: NodeJS.Timeout;

  constructor(private readonly config: ConfigService, private readonly gateway: GeoSurgeLiveGateway) {}

  onModuleInit() {
    const url = this.config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379';
    this.redis = new Redis(url);
    this.logger.log(`✅ GeoSurge connected to Redis → ${url}`);
    // start periodic recalc
    this.interval = setInterval(() => this.recalcAndBroadcast().catch(err => this.logger.error('recalc err', err)), this.calcIntervalMs);
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
    try { this.redis.disconnect(); } catch {}
  }

  /** Add or update a presence point (e.g. rider available or order location).
   * memberId should be unique for the point (e.g. `rider:123` or `order:456`)
   */
  async addPoint(memberId: string, lon: number, lat: number) {
    // GEOADD expects lon, lat, member
    await this.redis.geoadd(this.key, lon, lat, memberId);
    await this.redis.hset(`geo:meta:${memberId}`, { lon: String(lon), lat: String(lat), updated: String(Date.now()) });
  }

  /** Remove a point (e.g. rider gone offline / order resolved) */
  async removePoint(memberId: string) {
    await this.redis.zrem(this.key, memberId);
    await this.redis.del(`geo:meta:${memberId}`);
  }

  /** Compute zone multipliers by sampling around a set of center points.
   * Here we compute hotspots by scanning distinct points and clustering via radius counts.
   */
  async recalcAndBroadcast(): Promise<GeoZone[]> {
    try {
      // get all members with coords
      const raw = await this.redis.zrange(this.key, 0, -1);
      if (!raw || raw.length === 0) {
        // nothing to broadcast (send an empty array)
        this.gateway.broadcastGeo([]);
        return [];
      }

      // for each member, fetch coords using GEOPOS
      // get coordinates in batches
      const members = raw;
      const coords = await Promise.all(members.map(m => this.redis.geopos(this.key, m)));
      const points = members.map((m, i) => {
        const p = coords[i]?.[0];
        return p ? { id: m, lon: parseFloat(p[0]), lat: parseFloat(p[1]) } : null;
      }).filter(Boolean) as { id: string; lon: number; lat: number }[];

      // Strategy: build centers equal to unique grid buckets (approx).
      // We'll bucket by rounding lat/lon to 3 decimal places (~100m). This produces zone centers.
      const buckets = new Map<string, { lon: number; lat: number; members: string[] }>();
      for (const pt of points) {
        const key = `${pt.lon.toFixed(3)}:${pt.lat.toFixed(3)}`;
        if (!buckets.has(key)) buckets.set(key, { lon: pt.lon, lat: pt.lat, members: [] });
        buckets.get(key)!.members.push(pt.id);
      }

      const zones: GeoZone[] = [];
      for (const [k, v] of buckets) {
        // count members within 300m of center using GEORADIUS
        // ioredis georadius signature: georadius(key, lon, lat, radius, unit, options...)
        const radiusKm = 0.3; // 300m
        // georadius returns members by default
        // Using raw redis command to avoid typings mismatch
        const nearby = await (this.redis as any).georadius(this.key, v.lon, v.lat, radiusKm, 'km');
        const count = nearby?.length ?? v.members.length;
        // compute multiplier: base 1.0, small scaling — tune as needed
        const multiplier = Number((1 + Math.min(2, count / 8)).toFixed(2)); // e.g. count 8 => +1 => x2.00 cap
        zones.push({
          id: k,
          lon: v.lon,
          lat: v.lat,
          count,
          multiplier,
          lastUpdated: Date.now(),
        });
      }

      // sort zones by multiplier desc (hotspots first) and broadcast top N
      zones.sort((a, b) => b.multiplier - a.multiplier);
      const top = zones.slice(0, 200); // avoid excessive payload

      this.gateway.broadcastGeo(top);
      this.logger.log(`🔺 GeoSurge broadcast ${top.length} zones`);
      return top;
    } catch (err) {
      this.logger.error('recalcAndBroadcast error', err as any);
      return [];
    }
  }
}
