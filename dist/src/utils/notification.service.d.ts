import { PrismaService } from './prisma.service';
export declare class NotificationService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    create(receiverId: number, type: string, message: string, meta?: any, senderId?: number): Promise<{
        message: string;
        type: string;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        status: string;
        createdAt: Date;
        id: number;
        senderId: number | null;
        receiverId: number;
    } | undefined>;
    sendAdminToast(data: {
        type: 'ok' | 'info' | 'err';
        title: string;
        text: string;
    }): void;
}
