import { PrismaService } from './prisma.service';
import { AuditLiveGateway } from '../ws/audit-live.gateway';
import { NotificationService } from './notification.service';
export declare class AuditService {
    private readonly prisma;
    private readonly live;
    private readonly notify;
    private readonly logger;
    constructor(prisma: PrismaService, live: AuditLiveGateway, notify: NotificationService);
    log({ userId, email, ip, userAgent, eventType, role, success, }: {
        userId?: number;
        email?: string | null | undefined;
        ip?: string;
        userAgent?: string;
        eventType: string;
        role?: string;
        success?: boolean;
    }): Promise<{
        email: string | null;
        role: string | null;
        id: number;
        userId: number | null;
        ip: string | null;
        userAgent: string | null;
        eventType: string;
        success: boolean;
        timestamp: Date;
    } | {
        error: boolean;
    }>;
}
