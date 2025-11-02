import { PrismaService } from './prisma.service';
import { WsGateway } from '../ws/ws.gateway';
export declare class NotificationService {
    private prisma;
    private wsGateway;
    constructor(prisma: PrismaService, wsGateway: WsGateway);
    create(receiverId: number, type: string, message: string, meta?: any, senderId?: number): Promise<{
        message: string;
        id: number;
        status: string;
        createdAt: Date;
        type: string;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        senderId: number | null;
        receiverId: number;
    }>;
}
