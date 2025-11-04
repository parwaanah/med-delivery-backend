import { PrismaService } from './prisma.service';
import { AdminAuditGateway } from '../ws/admin.audit.gateway';
export declare class AuditService {
    private prisma;
    private auditGateway;
    constructor(prisma: PrismaService, auditGateway: AdminAuditGateway);
    log({ userId, email, ip, userAgent, eventType, role, success, }: {
        userId?: number;
        email?: string;
        ip?: string;
        userAgent?: string;
        eventType: string;
        role?: string;
        success?: boolean;
    }): Promise<{
        email: string | null;
        role: string | null;
        userId: number | null;
        ip: string | null;
        userAgent: string | null;
        eventType: string;
        success: boolean;
        timestamp: Date;
        id: number;
    }>;
}
