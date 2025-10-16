import { AuditService } from './audit.service';
export declare class AuditController {
    private readonly auditService;
    constructor(auditService: AuditService);
    getAll(): Promise<{
        id: number;
        actorId: number | null;
        actorRole: string;
        action: string;
        targetType: string;
        targetId: number | null;
        details: import(".prisma/client").Prisma.JsonValue | null;
        createdAt: Date;
    }[]>;
    filter(role?: string, targetType?: string, fromDate?: string, toDate?: string): Promise<{
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
