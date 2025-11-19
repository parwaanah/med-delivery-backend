import { ConfigService } from '@nestjs/config';
import { GeoSurgeLiveGateway } from '../ws/geo-surge-live.gateway';
export type GeoPoint = {
    memberId: string;
    meta?: any;
    distKm?: number;
};
export declare class GeoSurgeService {
    private readonly config;
    private readonly gateway?;
    private readonly logger;
    private redis;
    private readonly redisUrl;
    private readonly GEO_KEY;
    constructor(config: ConfigService, gateway?: GeoSurgeLiveGateway | undefined);
    private initRedis;
    addPoint(id: string, lon: number, lat: number, meta?: any): Promise<void>;
    removePoint(id: string): Promise<void>;
    findNearbyPoints(lon: number, lat: number, km?: number, includeMeta?: boolean, limit?: number): Promise<GeoPoint[]>;
    broadcastGeo(zones: any[]): void;
}
