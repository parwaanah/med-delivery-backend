import { PrismaService } from './prisma.service';
import { WsGateway } from '../ws/ws.gateway';
export declare class AuditService {
    private readonly prisma;
    private readonly ws;
    private readonly logger;
    constructor(prisma: PrismaService, ws: WsGateway);
    log(params: {
        userId?: number;
        email?: string;
        role?: string;
        eventType: string;
        success: boolean;
        ip?: string;
        userAgent?: string;
        meta?: any;
    }): Promise<{
        userId: number | null;
        action: string;
        resource: string | null;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
        id: number;
    } | null>;
    logAdminAction(params: {
        userId?: number;
        action: string;
        resource?: string;
        meta?: any;
    }): Promise<{
        userId: number | null;
        action: string;
        resource: string | null;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
        id: number;
    } | null>;
}
