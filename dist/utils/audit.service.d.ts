import { PrismaService } from './prisma.service';
export declare class AuditService {
    private prisma;
    constructor(prisma: PrismaService);
    log({ userId, email, ip, userAgent, eventType, role, success, }: {
        userId?: number;
        email?: string;
        ip?: string;
        userAgent?: string;
        eventType: string;
        role?: string;
        success?: boolean;
    }): Promise<void>;
}
