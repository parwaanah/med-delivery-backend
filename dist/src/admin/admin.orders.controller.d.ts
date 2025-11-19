import { PrismaService } from '../utils/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { GeoSurgeService } from '../geosurge/geo-surge.service';
export declare class AdminOrdersController {
    private prisma;
    private ordersService;
    private geo;
    constructor(prisma: PrismaService, ordersService: OrdersService, geo: GeoSurgeService);
    debugRedis(): Promise<{
        keys: string[];
        riderCount: number;
        allPoints: string[];
        meta: Record<string, any>;
    }>;
    getAllOrders(): Promise<{
        total: number;
        orders: ({
            customer: {
                email: string;
            };
            pharmacy: {
                email: string;
            };
            rider: {
                email: string;
            } | null;
        } & {
            status: import(".prisma/client").$Enums.OrderStatus;
            totalPrice: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            id: number;
            customerId: number;
            pharmacyId: number;
            riderId: number | null;
        })[];
    }>;
    assignRider(id: string, body: {
        adminId: number;
        riderId: number;
    }): Promise<any>;
    getCandidateRiders(id: string): Promise<{
        total: number;
        candidates: any[];
    }>;
}
