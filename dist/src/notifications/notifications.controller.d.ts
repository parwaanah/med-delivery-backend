import { PrismaService } from '../utils/prisma.service';
export declare class NotificationsController {
    private prisma;
    constructor(prisma: PrismaService);
    getAdminNotifications(req: any): Promise<{
        message: string;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
        id: number;
        status: string;
        type: string;
        senderId: number | null;
        receiverId: number;
    }[]>;
}
