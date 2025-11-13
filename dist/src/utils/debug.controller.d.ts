import { NotificationService } from './notification.service';
export declare class DebugController {
    private notificationService;
    constructor(notificationService: NotificationService);
    sendTestNotification(body: {
        userId: number;
        type: string;
        message: string;
        meta?: any;
    }): Promise<{
        message: string;
        type: string;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        status: string;
        createdAt: Date;
        id: number;
        senderId: number | null;
        receiverId: number;
    } | undefined>;
}
