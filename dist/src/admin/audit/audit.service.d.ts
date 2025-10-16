import { PrismaService } from '../../../prisma/prisma.service';
export declare class AuditService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    record(actorId: number | null, actorRole: 'admin' | 'pharmacy' | 'rider' | 'customer' | 'system', action: string, targetType: string, targetId?: number, extra?: Record<string, any>): Promise<void>;
    getAllLogs(): Promise<{
        id: number;
        actorId: number | null;
        actorRole: string;
        action: string;
        targetType: string;
        targetId: number | null;
        details: import(".prisma/client").Prisma.JsonValue | null;
        createdAt: Date;
    }[]>;
    filterLogs(role?: string, targetType?: string, fromDate?: string, toDate?: string): Promise<{
        id: number;
        actorId: number | null;
        actorRole: string;
        action: string;
        targetType: string;
        targetId: number | null;
        details: import(".prisma/client").Prisma.JsonValue | null;
        createdAt: Date;
    }[]>;
}
