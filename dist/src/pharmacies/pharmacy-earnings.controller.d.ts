import { Request } from 'express';
import { PrismaService } from '../utils/prisma.service';
import { ConfigService } from '@nestjs/config';
export declare class PharmacyEarningsController {
    private readonly prisma;
    private readonly config;
    constructor(prisma: PrismaService, config: ConfigService);
    private commissionPct;
    summary(req: Request & {
        user: any;
    }): Promise<{
        totalOrders: number;
        completedOrders: number;
        revenue: number;
        commissionPct: number;
        commissionAmount: number;
        netPayout: number;
        last7days: {
            commissionAmount: number;
            netPayout: number;
            date: string;
            revenue: number;
            completedOrders: number;
        }[];
    }>;
    transactions(req: Request & {
        user: any;
    }, takeRaw?: string, daysRaw?: string): Promise<{
        transactions: {
            id: string;
            provider: string;
            providerOrder: string | null;
            providerPayment: string | null;
            amount: number;
            currency: string;
            status: string;
            method: string | null;
            createdAt: Date;
            refunded: boolean;
            commissionPct: number;
            commissionAmount: number;
            netPayout: number;
            order: {
                id: number;
                status: import(".prisma/client").$Enums.OrderStatus;
                totalPrice: number;
                createdAt: Date;
            } | {
                id: number;
                status?: undefined;
                totalPrice?: undefined;
                createdAt?: undefined;
            } | null;
        }[];
    }>;
    ledger(req: Request & {
        user: any;
    }, takeRaw?: string, daysRaw?: string): Promise<{
        commissionPct: number;
        totals: {
            gross: number;
            commission: number;
            net: number;
        };
        rows: {
            order: {
                id: number;
                status: import(".prisma/client").$Enums.OrderStatus;
                totalPrice: number;
                createdAt: Date;
                deliveredAt: any;
            };
            refunded: boolean;
            eligibleForPayout: boolean;
            settled: boolean;
            settledAt: Date | null;
            commissionPct: number;
            commissionAmount: number;
            netPayout: number;
            transactions: {
                id: any;
                provider: any;
                providerOrder: any;
                providerPayment: any;
                amount: number;
                currency: any;
                status: any;
                method: any;
                createdAt: any;
            }[];
        }[];
    }>;
}
