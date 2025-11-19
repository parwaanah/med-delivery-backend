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
            amount: import("@prisma/client/runtime/library").Decimal;
            currency: string;
            method: string | null;
            id: string;
            orderId: number | null;
            provider: string;
            providerOrder: string | null;
            providerPayment: string | null;
            status: string;
            rawData: import("@prisma/client/runtime/library").JsonValue | null;
            createdAt: Date;
        };
    }>;
    webhook(req: Request, res: Response, signature: string): Promise<Response<any, Record<string, any>>>;
    refund(dto: RefundDto): Promise<import("razorpay/dist/types/refunds").Refunds.RazorpayRefund>;
    adminList(): Promise<{
        amount: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        method: string | null;
        id: string;
        orderId: number | null;
        provider: string;
        providerOrder: string | null;
        providerPayment: string | null;
        status: string;
        rawData: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
    }[]>;
    byOrder(orderId: string): Promise<{
        amount: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        method: string | null;
        id: string;
        orderId: number | null;
        provider: string;
        providerOrder: string | null;
        providerPayment: string | null;
        status: string;
        rawData: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
    }[]>;
}
