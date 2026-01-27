import { PrismaService } from '../utils/prisma.service';
import { Response } from 'express';
export declare class AdminAuditController {
    private prisma;
    constructor(prisma: PrismaService);
    getLogs(page?: string, limit?: string, action?: string, userId?: string, resource?: string, from?: string, to?: string): Promise<{
        page: number;
        limit: number;
        total: number;
        logs: {
            userId: number | null;
            action: string;
            resource: string | null;
            meta: import("@prisma/client/runtime/library").JsonValue | null;
            createdAt: Date;
            id: number;
        }[];
    }>;
    exportCsv(from: string, to: string, res: Response): Promise<void>;
}
