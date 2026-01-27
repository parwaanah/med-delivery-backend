import { PrismaService } from '../utils/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { AuditService } from '../utils/audit.service';
export declare class AdminOpsController {
    private readonly prisma;
    private readonly orders;
    private readonly payments;
    private readonly audit;
    constructor(prisma: PrismaService, orders: OrdersService, payments: PaymentsService, audit: AuditService);
    private clampInt;
    private stageStart;
    private slaFor;
    liveOrders(takeRaw?: string, onlyBreachedRaw?: string): Promise<{
        take: number;
        total: number;
        orders: any[];
    }>;
    reassign(id: string, riderId: string, body: {
        note?: string;
    }, req: any): Promise<any>;
    completeDelivery(id: string, body: {
        note?: string;
        proofUrl?: string;
        signatureUrl?: string;
        otp?: string;
    }, req: any): Promise<{
        ok: boolean;
        order: any;
    }>;
    emergencyRefund(id: string, body: {
        amount?: number;
        note?: string;
    }, req: any): Promise<import("razorpay/dist/types/refunds").Refunds.RazorpayRefund | {
        ok: boolean;
        refunded: boolean;
        already: boolean;
        mock?: undefined;
        provider?: undefined;
    } | {
        mock: boolean;
        refunded: boolean;
        ok?: undefined;
        already?: undefined;
        provider?: undefined;
    } | {
        ok: boolean;
        refunded: boolean;
        provider: string;
        already?: undefined;
        mock?: undefined;
    }>;
    escalateSla(id: string, body: {
        reason?: string;
        note?: string;
    }, req: any): Promise<{
        ok: boolean;
    }>;
}
