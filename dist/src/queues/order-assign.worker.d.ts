import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { WsGateway } from '../ws/ws.gateway';
import { EscalationService } from '../admin/escalation.service';
export declare class OrderAssignWorker implements OnModuleInit, OnModuleDestroy {
    private config;
    private prisma;
    private notify;
    private ws;
    private esc;
    private worker;
    private redisClient;
    private readonly logger;
    constructor(config: ConfigService, prisma: PrismaService, notify: NotificationService, ws: WsGateway, esc: EscalationService);
    onModuleInit(): void;
    onModuleDestroy(): Promise<void>;
}
