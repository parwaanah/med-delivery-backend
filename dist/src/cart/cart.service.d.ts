import { PrismaService } from '../utils/prisma.service';
import { SurgeService } from '../surge/surge.service';
import { PaymentsService } from '../payments/payments.service';
import { OrdersService } from '../orders/orders.service';
export declare class CartService {
    private prisma;
    private surge;
    private payments;
    private orders;
    constructor(prisma: PrismaService, surge: SurgeService, payments: PaymentsService, orders: OrdersService);
    calculateTotal(userId: number, items: any[]): Promise<{
        baseTotal: any;
        surgeMultiplier: number;
        total: number;
        message: string;
    }>;
    checkout(userId: number, dtoItems: any[], opts?: {
        pharmacyId?: number;
        pickupLat?: number;
        pickupLon?: number;
    }): Promise<{
        orderId: any;
        order: any;
        paymentIntent: {
            mock: boolean;
            razorpayOrder: {
                id: string;
                amount: number;
                currency: string;
                status: string;
            };
            transaction: {
                status: string;
                createdAt: Date;
                id: string;
                provider: string;
                providerOrder: string | null;
                providerPayment: string | null;
                amount: import("@prisma/client/runtime/library").Decimal;
                currency: string;
                method: string | null;
                rawData: import("@prisma/client/runtime/library").JsonValue | null;
                orderId: number | null;
            };
        } | {
            razorpayOrder: any;
            transaction: {
                status: string;
                createdAt: Date;
                id: string;
                provider: string;
                providerOrder: string | null;
                providerPayment: string | null;
                amount: import("@prisma/client/runtime/library").Decimal;
                currency: string;
                method: string | null;
                rawData: import("@prisma/client/runtime/library").JsonValue | null;
                orderId: number | null;
            };
            mock?: undefined;
        };
        message: string;
    }>;
}
