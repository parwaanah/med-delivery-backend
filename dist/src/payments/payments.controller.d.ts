import { PaymentsService } from "./payments.service";
import { RazorpayService } from "./razorpay.service";
import { PrismaService } from "../utils/prisma.service";
import { Request, Response } from "express";
import { CreateIntentDto } from "./dto/create-intent.dto";
import { RefundDto } from "./dto/refund.dto";
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
    webhook(req: Request, res: Response, signature: string): Promise<Response<any, Record<string, any>>>;
    refund(req: any, dto: RefundDto): Promise<import("razorpay/dist/types/refunds").Refunds.RazorpayRefund | {
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
    adminList(): Promise<{
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
    byOrder(orderId: string): Promise<{
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
    devPayOrder(req: any, body: {
        orderId: number;
    }): Promise<{
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
}
