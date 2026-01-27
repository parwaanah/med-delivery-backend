import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { WsGateway } from '../ws/ws.gateway';
export declare class OrdersSlaCron {
    private readonly prisma;
    private readonly notify;
    private readonly ws;
    private readonly config;
    private readonly logger;
    constructor(prisma: PrismaService, notify: NotificationService, ws: WsGateway, config: ConfigService);
    private slaMinutes;
    handlePharmacyAcceptSla(): Promise<void>;
}
