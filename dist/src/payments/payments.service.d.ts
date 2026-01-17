import { PrismaService } from '../utils/prisma.service';
import { RazorpayService } from './razorpay.service';
import { AuditService } from '../utils/audit.service';
export declare class PaymentsService {
    private prisma;
    private razorpay;
    private audit;
    private readonly logger;
    constructor(prisma: PrismaService, razorpay: RazorpayService, audit: AuditService);
    createPaymentForOrder(orderId: number): Promise<{
        mock: boolean;
        transaction: {
            createdAt: Date;
            id: string;
            status: string;
            method: string | null;
            amount: import("@prisma/client/runtime/library").Decimal;
            currency: string;
            provider: string;
            providerOrder: string | null;
            providerPayment: string | null;
            rawData: import("@prisma/client/runtime/library").JsonValue | null;
            orderId: number | null;
        };
        razorpayOrder?: undefined;
    } | {
        razorpayOrder: any;
        transaction: {
            createdAt: Date;
            id: string;
            status: string;
            method: string | null;
            amount: import("@prisma/client/runtime/library").Decimal;
            currency: string;
            provider: string;
            providerOrder: string | null;
            providerPayment: string | null;
            rawData: import("@prisma/client/runtime/library").JsonValue | null;
            orderId: number | null;
        };
        mock?: undefined;
    }>;
    handleWebhookEvent(event: any): Promise<void>;
    private handlePaymentSuccess;
    private handlePaymentFailed;
    refundTransaction(transactionId: string, amount?: number, adminUserId?: number): Promise<import("razorpay/dist/types/refunds").Refunds.RazorpayRefund | {
        mock: boolean;
        refunded: boolean;
    }>;
    listTransactions(): Promise<{
        createdAt: Date;
        id: string;
        status: string;
        method: string | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        provider: string;
        providerOrder: string | null;
        providerPayment: string | null;
        rawData: import("@prisma/client/runtime/library").JsonValue | null;
        orderId: number | null;
    }[]>;
}
