import { PrismaService } from './prisma.service';
import { WsGateway } from '../ws/ws.gateway';
export declare class NotificationService {
    private prisma;
    private ws;
    private readonly logger;
    constructor(prisma: PrismaService, ws: WsGateway);
    create(receiverId: number, type: string, message: string, meta?: Record<string, any>, senderId?: number): Promise<{
        message: string;
        type: string;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        status: string;
        createdAt: Date;
        id: number;
        senderId: number | null;
        receiverId: number;
    }>;
    sendAdminToast(payload: {
        type: 'ok' | 'err' | 'info';
        title: string;
        text: string;
        meta?: any;
    }): Promise<void>;
    markRead(notificationId: number, userId: number): Promise<{
        message: string;
        type: string;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        status: string;
        createdAt: Date;
        id: number;
        senderId: number | null;
        receiverId: number;
    } | null>;
    listForUser(userId: number, page?: number, limit?: number): Promise<{
        items: {
            message: string;
            type: string;
            meta: import("@prisma/client/runtime/library").JsonValue | null;
            status: string;
            createdAt: Date;
            id: number;
            senderId: number | null;
            receiverId: number;
        }[];
        total: number;
        page: number;
        limit: number;
    }>;
}
