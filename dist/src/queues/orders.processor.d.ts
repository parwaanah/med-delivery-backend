import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { WsGateway } from '../ws/ws.gateway';
export declare class OrdersProcessor implements OnModuleInit, OnModuleDestroy {
    private config;
    private prisma;
    private notify;
    private ws;
    private worker;
    private readonly logger;
    private redisClient;
    private dlq;
    constructor(config: ConfigService, prisma: PrismaService, notify: NotificationService, ws: WsGateway);
    onModuleInit(): void;
    onModuleDestroy(): Promise<void>;
}
