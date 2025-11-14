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

export interface GeoPoint {
  memberId: string; // e.g. 'rider:123' or 'order:456'
  lon: number;
  lat: number;
  distKm?: number; // when returned from a radius query
  meta?: { [k: string]: string };
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
    this.interval = setInterval(() => this.recalcAndBroadcast().catch(err => this.logger.error('recalc err', err)), this.calcIntervalMs);
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
    try { this.redis.disconnect(); } catch {}
  }

  /** Add or update a presence point (memberId unique) */
  async addPoint(memberId: string, lon: number, lat: number) {
    // GEOADD expects lon, lat, member
    await this.redis.geoadd(this.key, lon, lat, memberId);
    // store meta for quick lookup
    await this.redis.hset(`geo:meta:${memberId}`, { lon: String(lon), lat: String(lat), updated: String(Date.now()) });
  }

  /** Remove a point */
  async removePoint(memberId: string) {
    await this.redis.zrem(this.key, memberId);
    await this.redis.del(`geo:meta:${memberId}`);
  }

  /**
   * Find nearby points around (lon, lat) within radiusKm.
   * Returns GeoPoint[] with optional distance (km) and meta map.
   */
  async findNearbyPoints(lon: number, lat: number, radiusKm = 2, withMeta = true, limit = 200): Promise<GeoPoint[]> {
    try {
      // georadius returns member list; request WITHDIST for distance
      // using raw command to support older ioredis typings
      const raw = await (this.redis as any).georadius(this.key, lon, lat, radiusKm, 'km', 'WITHDIST', 'COUNT', limit, 'ASC');
      if (!raw || !raw.length) return [];

      // raw is array of [member, dist] entries (when WITHDIST)
      const points: GeoPoint[] = [];
      for (const entry of raw) {
        const memberId = entry[0];
        const distKm = Number(entry[1]);
        const p = { memberId, lon: 0, lat: 0, distKm } as GeoPoint;
        if (withMeta) {
          try {
            const meta = await this.redis.hgetall(`geo:meta:${memberId}`);
            if (meta && Object.keys(meta).length) p.meta = meta;
            if (meta?.lon && meta?.lat) {
              p.lon = parseFloat(meta.lon);
              p.lat = parseFloat(meta.lat);
            }
          } catch (err) {
            // ignore meta read errors
          }
        }
        points.push(p);
      }
      return points;
    } catch (err) {
      this.logger.warn('findNearbyPoints failed', (err as any)?.message ?? err);
      return [];
    }
  }

  /** Compute zone multipliers by sampling points (unchanged core algorithm) */
  async recalcAndBroadcast(): Promise<GeoZone[]> {
    try {
      const raw = await this.redis.zrange(this.key, 0, -1);
      if (!raw || raw.length === 0) {
        this.gateway.broadcastGeo([]);
        return [];
      }

      const members = raw;
      const coords = await Promise.all(members.map(m => this.redis.geopos(this.key, m)));
      const points = members.map((m, i) => {
        const p = coords[i]?.[0];
        return p ? { id: m, lon: parseFloat(p[0]), lat: parseFloat(p[1]) } : null;
      }).filter(Boolean) as { id: string; lon: number; lat: number }[];

      const buckets = new Map<string, { lon: number; lat: number; members: string[] }>();
      for (const pt of points) {
        const key = `${pt.lon.toFixed(3)}:${pt.lat.toFixed(3)}`;
        if (!buckets.has(key)) buckets.set(key, { lon: pt.lon, lat: pt.lat, members: [] });
        buckets.get(key)!.members.push(pt.id);
      }

      const zones: GeoZone[] = [];
      for (const [k, v] of buckets) {
        const radiusKm = 0.3; // 300m
        const nearby = await (this.redis as any).georadius(this.key, v.lon, v.lat, radiusKm, 'km');
        const count = nearby?.length ?? v.members.length;
        const multiplier = Number((1 + Math.min(2, count / 8)).toFixed(2));
        zones.push({
          id: k,
          lon: v.lon,
          lat: v.lat,
          count,
          multiplier,
          lastUpdated: Date.now(),
        });
      }

      zones.sort((a, b) => b.multiplier - a.multiplier);
      const top = zones.slice(0, 200);

      this.gateway.broadcastGeo(top);
      this.logger.log(`🔺 GeoSurge broadcast ${top.length} zones`);
      return top;
    } catch (err) {
      this.logger.error('recalcAndBroadcast error', err as any);
      return [];
    }
  }
}
