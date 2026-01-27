import { PrismaService } from './prisma.service';
import { WsGateway } from '../ws/ws.gateway';
export declare class NotificationService {
    private prisma;
    private ws;
    private readonly logger;
    constructor(prisma: PrismaService, ws: WsGateway);
    create(receiverId: number, type: string, message: string, meta?: any, senderId?: number): Promise<{
        message: string;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
        id: number;
        status: string;
        type: string;
        senderId: number | null;
        receiverId: number;
    } | undefined>;
    createDomainEvent<TPayload extends Record<string, any>>(receiverId: number, eventName: string, message: string, payload: TPayload, senderId?: number): Promise<{
        message: string;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
        id: number;
        status: string;
        type: string;
        senderId: number | null;
        receiverId: number;
    } | undefined>;
    sendAdminToast(data: {
        type: 'ok' | 'info' | 'err';
        title: string;
        text: string;
    }): void;
}
