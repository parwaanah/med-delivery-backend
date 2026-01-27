import { PrismaService } from '../utils/prisma.service';
export declare class ReportsService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getSystemSummary(): Promise<{
        totalOrders: number;
        paidOrders: number;
        revenue: number;
        refundedAmount: number;
        transactions: number;
    }>;
    getTransactions(params: {
        page: number;
        limit: number;
        status?: string;
    }): Promise<{
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
    generateDailyReport(): Promise<{
        json: string;
        pdf: string;
        csv: string;
    }>;
    private createPdfReport;
    private createCsvReport;
}
