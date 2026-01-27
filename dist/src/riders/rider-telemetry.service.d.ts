import { PrismaService } from '../utils/prisma.service';
import { RedisService } from '../utils/redis.service';
import { GeoSurgeService } from '../geosurge/geo-surge.service';
import { WsGateway } from '../ws/ws.gateway';
import { RiderShiftService } from './rider-shift.service';
import { RiderQualityService } from './rider-quality.service';
type LocationHeartbeat = {
    lat: number;
    lon: number;
    accuracyM?: number;
    speedMps?: number;
    headingDeg?: number;
    tsMs?: number;
};
export declare class RiderTelemetryService {
    private readonly prisma;
    private readonly redis;
    private readonly geo;
    private readonly ws;
    private readonly shifts;
    private readonly quality;
    private readonly logger;
    constructor(prisma: PrismaService, redis: RedisService, geo: GeoSurgeService, ws: WsGateway, shifts: RiderShiftService, quality: RiderQualityService);
    private locKey;
    private lastPersistKey;
    private routeDevKey;
    private clamp;
    private toRad;
    private haversineKm;
    private persistIntervalMs;
    private locTtlSec;
    private computeConfidence;
    private maybePersistLocation;
    private maybeDetectRouteDeviation;
    locationHeartbeat(riderId: number, hb: LocationHeartbeat): Promise<{
        ok: boolean;
        confidence?: undefined;
    } | {
        ok: boolean;
        confidence: number;
    }>;
}
export {};
