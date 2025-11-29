import { PrismaService } from '../utils/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { GeoSurgeService } from '../geosurge/geo-surge.service';
export declare class AdminOrdersController {
    private prisma;
    private ordersService;
    private geo;
    constructor(prisma: PrismaService, ordersService: OrdersService, geo: GeoSurgeService);
    getCandidateRiders(id: string): Promise<{
        total: number;
        candidates: {
            score: number;
            memberId: string;
            meta?: any;
            distKm?: number;
        }[];
    }>;
}
