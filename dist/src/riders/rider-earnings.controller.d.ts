import { RiderPaymentsService } from './rider-payments.service';
export declare class RiderEarningsController {
    private readonly earnings;
    constructor(earnings: RiderPaymentsService);
    summary(req: any): Promise<{
        totalOrders: any;
        revenue: number;
        pendingPayout: number;
        last7days: {
            items: any;
            net: number;
        };
    }>;
    transactions(req: any, status?: string, limit?: string): Promise<{
        items: {
            id: any;
            orderId: any;
            orderStatus: any;
            type: any;
            createdAt: any;
            distanceKm: any;
            baseFare: number;
            distanceFare: number;
            surgeMultiplier: any;
            surgeBonus: number;
            bonus: number;
            penalty: number;
            netAmount: number;
            status: any;
            batchId: any;
            settledAt: any;
            meta: any;
        }[];
        limit: number;
    }>;
}
