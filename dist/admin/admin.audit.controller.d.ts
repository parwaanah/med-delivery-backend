import { PrismaService } from '../utils/prisma.service';
export declare class AdminAuditController {
    private prisma;
    constructor(prisma: PrismaService);
    getAuditLogs(page?: number, limit?: number, userId?: number, email?: string, eventType?: string, role?: string, success?: boolean): Promise<{
        page: number;
        limit: number;
        total: number;
        logs: {
            email: string | null;
            role: string | null;
            userId: number | null;
            ip: string | null;
            userAgent: string | null;
            eventType: string;
            success: boolean;
            timestamp: Date;
            id: number;
        }[];
    }>;
    getAuditStats(): Promise<{
        totalEvents: number;
        successCount: number;
        failedCount: number;
        successRate: number;
    }>;
}
