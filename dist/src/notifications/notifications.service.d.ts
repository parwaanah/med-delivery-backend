export declare class NotificationsService {
    sendPush(targetType: 'pharmacy' | 'rider', targetId: number, title: string, message: string): Promise<{
        stored: boolean;
        pushSent: boolean;
    }>;
    getNotificationsForUser(role: string, userId: number): Promise<{
        id: number;
        targetType: string;
        targetId: number;
        title: string;
        message: string;
        createdAt: Date;
    }[]>;
}
