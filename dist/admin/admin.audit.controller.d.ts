import { PrismaService } from '../utils/prisma.service';
export declare class AdminAuditController {
    private prisma;
    constructor(prisma: PrismaService);
    getAuditLogs(page?: string, limit?: string, userId?: string, email?: string, eventType?: string, role?: string, success?: string): Promise<{
        page: number;
        limit: number;
        total: number;
        logs: {
            email: string | null;
            role: string | null;
            userId: number | null;
            id: number;
            ip: string | null;
            userAgent: string | null;
            eventType: string;
            success: boolean;
            timestamp: Date;
        }[];
    }>;
    getAuditStats(): Promise<{
        totalEvents: number;
        successCount: number;
        failedCount: number;
        successRate: number;
        lastUpdated: string;
    }>;
}
