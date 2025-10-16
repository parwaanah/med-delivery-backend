import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private readonly notificationsService;
    constructor(notificationsService: NotificationsService);
    getMyNotifications(req: any): Promise<{
        id: number;
        targetType: string;
        targetId: number;
        title: string;
        message: string;
        createdAt: Date;
    }[]>;
    sendTestNotification(body: {
        targetType: 'pharmacy' | 'rider';
        targetId: number;
        title: string;
        message: string;
    }): Promise<{
        stored: boolean;
        pushSent: boolean;
    }>;
}
