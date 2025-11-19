import { PrismaService } from '../utils/prisma.service';
import { GeoSurgeService } from '../geosurge/geo-surge.service';
import { SurgeService } from '../surge/surge.service';
export declare class EscalationService {
    private prisma;
    private geoSurge;
    private surge;
    private readonly logger;
    private readonly defaultRiderSearchKm;
    private readonly riderSpeedKmPerHr;
    constructor(prisma: PrismaService, geoSurge: GeoSurgeService, surge: SurgeService);
    private toRad;
    private haversineKm;
    private computeRiderScore;
    findCandidatesForOrder(orderId: number, radiusKm?: number, limit?: number): Promise<{
        riderId: number | null;
        score: number;
        distKm: number | null;
        meta: any;
    }[]>;
}
