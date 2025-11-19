import { PrismaService } from '../utils/prisma.service';
export declare class NotificationsController {
    private prisma;
    constructor(prisma: PrismaService);
    getAdminNotifications(req: any): Promise<{
        message: string;
        type: string;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        status: string;
        createdAt: Date;
        id: number;
        senderId: number | null;
        receiverId: number;
    }[]>;
}
