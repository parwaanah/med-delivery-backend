import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { GeoSurgeLiveGateway } from '../ws/geo-surge-live.gateway';

export type GeoPoint = {
  memberId: string;
  meta?: any;
  distKm?: number;
};

@Injectable()
export class GeoSurgeService {
  private readonly logger = new Logger(GeoSurgeService.name);
  private redis!: Redis;
  private readonly redisUrl: string;

  private readonly GEO_KEY = 'geosurge:riders';

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly gateway?: GeoSurgeLiveGateway,
  ) {
    this.redisUrl = this.config.get('REDIS_URL') || 'redis://redis:6379';
    this.initRedis();
  }

  private initRedis() {
    try {
      this.redis = new Redis(this.redisUrl);

      this.redis.on('connect', () =>
        this.logger.log(`✅ GeoSurge connected → ${this.redisUrl}`),
      );
      this.redis.on('error', (err) =>
        this.logger.warn(
          'Redis error:',
          (err as any)?.message ?? JSON.stringify(err),
        ),
      );
    } catch (err) {
      this.logger.error(
        'Failed to init Redis for GeoSurge',
        (err as any)?.message ?? JSON.stringify(err),
      );
    }
  }

  /** Add rider point */
  async addPoint(id: string, lon: number, lat: number, meta: any = {}) {
    try {
      await this.redis.geoadd(this.GEO_KEY, lon, lat, id);

      await this.redis.hset(
        `geo:meta:${id}`,
        'lon',
        String(lon),
        'lat',
        String(lat),
        'meta',
        JSON.stringify(meta),
      );
    } catch (err) {
      this.logger.warn(
        `addPoint failed for ${id}`,
        (err as any)?.message ?? JSON.stringify(err),
      );
    }
  }

  /** Remove rider */
  async removePoint(id: string) {
    try {
      await this.redis.zrem(this.GEO_KEY, id);
      await this.redis.del(`geo:meta:${id}`);
    } catch (err) {
      this.logger.warn(
        'removePoint failed',
        (err as any)?.message ?? JSON.stringify(err),
      );
    }
  }

  /** Correct GEOSEARCH for ioredis */
  async findNearbyPoints(
    lon: number,
    lat: number,
    km = 5,
    includeMeta = true,
    limit = 50,
  ): Promise<GeoPoint[]> {
    try {
      const raw = await this.redis.geosearch(
        this.GEO_KEY,
        'FROMLONLAT',
        lon,
        lat,
        'BYRADIUS',
        km,
        'km',
        'WITHDIST',
        'COUNT',
        limit,
        'ASC',
      );

      if (!raw || raw.length === 0) return [];

      const items: GeoPoint[] = [];

      for (const entry of raw as any[]) {
        const memberId = entry[0];
        const distKm = parseFloat(entry[1]);

        let meta = {};
        if (includeMeta) {
          const h = await this.redis.hgetall(`geo:meta:${memberId}`);
          if (h.meta) meta = JSON.parse(h.meta);
        }

        items.push({
          memberId,
          distKm,
          meta,
        });
      }

      return items;
    } catch (err) {
      this.logger.warn(
        'findNearbyPoints failed',
        (err as any)?.message ?? JSON.stringify(err),
      );
      return [];
    }
  }

  broadcastGeo(zones: any[]) {
    try {
      if (this.gateway) this.gateway.broadcastGeo(zones);
    } catch (_) {}
  }
}
