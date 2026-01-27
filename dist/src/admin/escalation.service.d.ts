import { PrismaService } from '../utils/prisma.service';
import { RedisService } from '../utils/redis.service';
import { GeoSurgeService } from '../geosurge/geo-surge.service';
import { SurgeService } from '../surge/surge.service';
export declare class EscalationService {
    private readonly prisma;
    private readonly redis;
    private readonly geoSurge;
    private readonly surge;
    private readonly logger;
    private readonly defaultRiderSearchKm;
    private readonly recentLoadWindowMs;
    private readonly ratingWindowDays;
    constructor(prisma: PrismaService, redis: RedisService, geoSurge: GeoSurgeService, surge: SurgeService);
    private toRad;
    private haversineKm;
    private riderAvailabilityKey;
    private riderIdleSinceKey;
    private parseRiderId;
    private computeScore;
    findCandidatesForOrder(orderId: number, radiusKm?: number, limit?: number): Promise<({
        riderId: null;
        score: number;
        distKm: number | null;
        meta: any;
    } | {
        riderId: number;
        score: number;
        distKm: number | null;
        meta: any;
    })[]>;
}
