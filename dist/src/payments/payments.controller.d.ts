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
    webhook(req: Request, res: Response, signature: string): Promise<Response<any, Record<string, any>>>;
    refund(dto: RefundDto): Promise<import("razorpay/dist/types/refunds").Refunds.RazorpayRefund>;
    adminList(): Promise<{
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
    byOrder(orderId: string): Promise<{
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
