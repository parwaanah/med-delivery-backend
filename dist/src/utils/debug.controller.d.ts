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
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
        id: number;
        status: string;
        type: string;
        senderId: number | null;
        receiverId: number;
    } | undefined>;
}
