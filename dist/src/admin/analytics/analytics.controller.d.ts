import { AnalyticsService } from './analytics.service';
export declare class AnalyticsController {
    private readonly analyticsService;
    constructor(analyticsService: AnalyticsService);
    getSummary(): Promise<{
        users: number;
        pharmacies: number;
        riders: number;
        totalOrders: number;
        deliveredOrders: number;
        cancelledOrders: number;
        deliveryRate: string;
    }>;
    getOrderTrends(): Promise<{
        date: string;
        count: number;
    }[]>;
    getTopPharmacies(): Promise<{
        name: string;
        total_orders: number;
    }[]>;
}
