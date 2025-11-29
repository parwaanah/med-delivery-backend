import { PrismaService } from '../utils/prisma.service';
import { RazorpayService } from './razorpay.service';
export declare class PaymentsService {
    private prisma;
    private razorpay;
    private readonly logger;
    constructor(prisma: PrismaService, razorpay: RazorpayService);
    createPaymentForOrder(orderId: number): Promise<{
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
            method: string | null;
            amount: import("@prisma/client/runtime/library").Decimal;
            currency: string;
            provider: string;
            providerOrder: string | null;
            providerPayment: string | null;
            rawData: import("@prisma/client/runtime/library").JsonValue | null;
            orderId: number | null;
        };
    } | {
        razorpayOrder: any;
        transaction: {
            status: string;
            createdAt: Date;
            id: string;
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
    refundTransaction(transactionId: string, amount?: number): Promise<import("razorpay/dist/types/refunds").Refunds.RazorpayRefund | {
        mock: boolean;
        refunded: boolean;
    }>;
    listTransactions(): Promise<{
        status: string;
        createdAt: Date;
        id: string;
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
