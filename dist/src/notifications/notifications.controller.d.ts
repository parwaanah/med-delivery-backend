import { PrismaService } from '../utils/prisma.service';
export declare class NotificationsController {
    private prisma;
    constructor(prisma: PrismaService);
    list(req: any): Promise<{
        message: string;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
        id: number;
        status: string;
        type: string;
        senderId: number | null;
        receiverId: number;
    }[]>;
    markRead(id: string, req: any): Promise<{
        ok: boolean;
    }>;
    markAllRead(req: any): Promise<{
        ok: boolean;
    }>;
}
