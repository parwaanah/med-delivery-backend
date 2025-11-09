import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
export declare class WebhooksService {
    private prisma;
    private notify;
    constructor(prisma: PrismaService, notify: NotificationService);
    handlePharmacyCallback(key: string, payload: any): Promise<{
        ok: boolean;
    }>;
    handleRiderCallback(key: string, payload: any): Promise<{
        ok: boolean;
    }>;
}
