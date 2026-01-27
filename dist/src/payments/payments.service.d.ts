import { PrismaService } from '../utils/prisma.service';
import { RazorpayService } from './razorpay.service';
import { AuditService } from '../utils/audit.service';
import { NotificationService } from '../utils/notification.service';
import { RiderPaymentsService } from '../riders/rider-payments.service';
import { LockService } from '../utils/lock.service';
export declare class PaymentsService {
    private prisma;
    private razorpay;
    private audit;
    private notify;
    private riderPayments;
    private lock;
    private readonly logger;
    constructor(prisma: PrismaService, razorpay: RazorpayService, audit: AuditService, notify: NotificationService, riderPayments: RiderPaymentsService, lock: LockService);
    createPaymentForOrder(orderId: number): Promise<{
        mock: boolean;
        transaction: {
            createdAt: Date;
            id: string;
            status: string;
            orderId: number | null;
            provider: string;
            providerOrder: string | null;
            providerPayment: string | null;
            amount: import("@prisma/client/runtime/library").Decimal;
            currency: string;
            method: string | null;
            rawData: import("@prisma/client/runtime/library").JsonValue | null;
        };
        razorpayOrder?: undefined;
    } | {
        razorpayOrder: any;
        transaction: {
            createdAt: Date;
            id: string;
            status: string;
            orderId: number | null;
            provider: string;
            providerOrder: string | null;
            providerPayment: string | null;
            amount: import("@prisma/client/runtime/library").Decimal;
            currency: string;
            method: string | null;
            rawData: import("@prisma/client/runtime/library").JsonValue | null;
        };
        mock?: undefined;
    }>;
    handleWebhookEvent(event: any): Promise<void>;
    private handlePaymentSuccess;
    devCaptureOrder(orderId: number, customerId: number): Promise<{
        ok: boolean;
        already: boolean;
        transaction?: undefined;
    } | {
        ok: boolean;
        transaction: {
            createdAt: Date;
            id: string;
            status: string;
            orderId: number | null;
            provider: string;
            providerOrder: string | null;
            providerPayment: string | null;
            amount: import("@prisma/client/runtime/library").Decimal;
            currency: string;
            method: string | null;
            rawData: import("@prisma/client/runtime/library").JsonValue | null;
        };
        already?: undefined;
    }>;
    private handlePaymentFailed;
    refundTransaction(transactionId: string, amount?: number, adminUserId?: number): Promise<import("razorpay/dist/types/refunds").Refunds.RazorpayRefund | {
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
    listTransactions(): Promise<{
        createdAt: Date;
        id: string;
        status: string;
        orderId: number | null;
        provider: string;
        providerOrder: string | null;
        providerPayment: string | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        method: string | null;
        rawData: import("@prisma/client/runtime/library").JsonValue | null;
    }[]>;
}
