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
            pharmacy: {
                email: string;
            };
            rider: {
                email: string;
            } | null;
            customer: {
                email: string;
            };
        } & {
            status: import(".prisma/client").$Enums.OrderStatus;
            createdAt: Date;
            id: number;
            updatedAt: Date;
            deletedAt: Date | null;
            pharmacyId: number;
            customerId: number;
            riderId: number | null;
            totalPrice: number;
        })[];
    }>;
    assignRider(id: string, body: {
        adminId: number;
        riderId: number;
    }): Promise<{
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
        id: number;
        updatedAt: Date;
        deletedAt: Date | null;
        pharmacyId: number;
        customerId: number;
        riderId: number | null;
        totalPrice: number;
    } | {
        error: string;
    }>;
    getCandidateRiders(id: string): Promise<{
        total: number;
        candidates: any[];
    }>;
}
