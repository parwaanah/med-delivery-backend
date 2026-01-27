import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../utils/prisma.service';
import { SurgeService } from '../surge/surge.service';
type TransactionsQuery = {
    status?: string;
    limit?: number;
};
export declare class RiderPaymentsService {
    private readonly prisma;
    private readonly config;
    private readonly surge;
    private readonly logger;
    private readonly baseFare;
    private readonly perKm;
    private readonly bonusPerOrder;
    private readonly cancellationPenalty;
    constructor(prisma: PrismaService, config: ConfigService, surge: SurgeService);
    private d;
    private haversineKm;
    private computeDistanceKm;
    private hasDeliveryProof;
    ensureDeliveryEarningForOrder(orderId: number): Promise<any>;
    handleRefundForOrder(orderId: number, opts?: {
        transactionId?: string;
        amount?: number;
        by?: string;
    }): Promise<{
        ok: boolean;
        changed: boolean;
        missing: boolean;
        settled?: undefined;
        updated?: undefined;
    } | {
        ok: boolean;
        changed: boolean;
        settled: boolean;
        missing?: undefined;
        updated?: undefined;
    } | {
        ok: boolean;
        changed: boolean;
        updated: any;
        missing?: undefined;
        settled?: undefined;
    }>;
    applyCancellationPenaltyForOrder(orderId: number, riderId: number, reason?: string): Promise<any>;
    getSummary(riderId: number): Promise<{
        totalOrders: any;
        revenue: number;
        pendingPayout: number;
        last7days: {
            items: any;
            net: number;
        };
    }>;
    getTransactions(riderId: number, query?: TransactionsQuery): Promise<{
        items: {
            id: any;
            orderId: any;
            orderStatus: any;
            type: any;
            createdAt: any;
            distanceKm: any;
            baseFare: number;
            distanceFare: number;
            surgeMultiplier: any;
            surgeBonus: number;
            bonus: number;
            penalty: number;
            netAmount: number;
            status: any;
            batchId: any;
            settledAt: any;
            meta: any;
        }[];
        limit: number;
    }>;
    createWeeklyBatch(periodStart: Date, periodEnd: Date, createdBy?: number): Promise<any>;
    markBatchPaid(batchId: number, paidBy?: number): Promise<any>;
    adminOverrideEarning(earningId: number, patch: {
        bonus?: number;
        penalty?: number;
    }): Promise<any>;
}
export {};
