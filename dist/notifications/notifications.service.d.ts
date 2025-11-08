import { PrismaService } from '../utils/prisma.service';
import { WsGateway } from '../ws/ws.gateway';
export declare class NotificationService {
    private prisma;
    private wsGateway;
    constructor(prisma: PrismaService, wsGateway: WsGateway);
    create(receiverId: number, type: string, message: string, meta?: any, senderId?: number): Promise<{
        message: string;
        type: string;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        status: string;
        createdAt: Date;
        id: number;
        senderId: number | null;
        receiverId: number;
    }>;
}
