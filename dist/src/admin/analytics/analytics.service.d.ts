export declare class AnalyticsService {
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
