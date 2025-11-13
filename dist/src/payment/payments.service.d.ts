import { PrismaService } from '../utils/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../utils/notification.service';
export declare class PaymentsService {
    private prisma;
    private config;
    private notify;
    private stripe;
    private webhookSecret;
    constructor(prisma: PrismaService, config: ConfigService, notify: NotificationService);
    createPaymentIntent(amount: number, userId: number): Promise<{
        clientSecret: string | null;
        id: string;
        amount: number;
    }>;
    handleWebhook(rawBody: Buffer, signature: string): Promise<{
        received: boolean;
    }>;
}
