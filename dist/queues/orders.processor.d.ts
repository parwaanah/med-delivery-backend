import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { WsGateway } from '../ws/ws.gateway';
export declare class OrdersProcessor implements OnModuleInit {
    private config;
    private prisma;
    private notify;
    private ws;
    private worker;
    constructor(config: ConfigService, prisma: PrismaService, notify: NotificationService, ws: WsGateway);
    onModuleInit(): void;
}
