import { ReportsService } from '../reports/reports.service';
import { Response } from 'express';
export declare class AdminReportsController {
    private readonly reports;
    constructor(reports: ReportsService);
    summary(): Promise<{
        totalOrders: number;
        paidOrders: number;
        revenue: number;
        refundedAmount: number;
        transactions: number;
    }>;
    transactions(page?: string, limit?: string, status?: string): Promise<{
        page: number;
        limit: number;
        total: number;
        items: {
            amount: number;
            createdAt: Date;
            id: string;
            status: string;
            orderId: number | null;
            provider: string;
            providerOrder: string | null;
            providerPayment: string | null;
            currency: string;
            method: string | null;
            rawData: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
    }>;
    exportDaily(format: "csv" | "pdf" | "json" | undefined, res: Response): Promise<void | Response<any, Record<string, any>>>;
}
