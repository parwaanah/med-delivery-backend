import { PrismaService } from '../utils/prisma.service';
import { RazorpayService } from './razorpay.service';
export declare class PaymentsService {
    private prisma;
    private rzp;
    private readonly logger;
    constructor(prisma: PrismaService, rzp: RazorpayService);
    createPaymentForOrder(orderId: number): Promise<{
        rzpOrder: any;
        transaction: {
            status: string;
            createdAt: Date;
            id: string;
            method: string | null;
            amount: import("@prisma/client/runtime/library").Decimal;
            currency: string;
            orderId: number | null;
            provider: string;
            providerOrder: string | null;
            providerPayment: string | null;
            rawData: import("@prisma/client/runtime/library").JsonValue | null;
        };
    }>;
    handleWebhookEvent(payload: any): Promise<{
        ok: boolean;
    }>;
    refundTransaction(txId: string, amount?: number): Promise<import("razorpay/dist/types/refunds").Refunds.RazorpayRefund>;
    listTransactions(): Promise<{
        status: string;
        createdAt: Date;
        id: string;
        method: string | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        orderId: number | null;
        provider: string;
        providerOrder: string | null;
        providerPayment: string | null;
        rawData: import("@prisma/client/runtime/library").JsonValue | null;
    }[]>;
}
