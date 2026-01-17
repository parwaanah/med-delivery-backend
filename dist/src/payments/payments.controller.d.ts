import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';
import { PrismaService } from '../utils/prisma.service';
import { Request, Response } from 'express';
import { CreateIntentDto } from './dto/create-intent.dto';
import { RefundDto } from './dto/refund.dto';
export declare class PaymentsController {
    private paymentsService;
    private rzpService;
    private prisma;
    constructor(paymentsService: PaymentsService, rzpService: RazorpayService, prisma: PrismaService);
    createIntent(body: CreateIntentDto): Promise<{
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
    webhook(req: Request, res: Response, signature: string): Promise<Response<any, Record<string, any>>>;
    refund(req: any, dto: RefundDto): Promise<import("razorpay/dist/types/refunds").Refunds.RazorpayRefund | {
        mock: boolean;
        refunded: boolean;
    }>;
    adminList(): Promise<{
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
    byOrder(orderId: string): Promise<{
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
