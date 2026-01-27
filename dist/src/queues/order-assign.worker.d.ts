import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { WsGateway } from '../ws/ws.gateway';
import { EscalationService } from '../admin/escalation.service';
export declare class OrderAssignWorker implements OnModuleInit, OnModuleDestroy {
    private readonly config;
    private readonly prisma;
    private readonly notify;
    private readonly ws;
    private readonly esc;
    private worker;
    private redisClient;
    private dlq;
    private readonly logger;
    constructor(config: ConfigService, prisma: PrismaService, notify: NotificationService, ws: WsGateway, esc: EscalationService);
    private offerLockKey;
    private offerRoundKey;
    private offerTtlSec;
    private offerBatchSize;
    private maxRounds;
    onModuleInit(): void;
    onModuleDestroy(): Promise<void>;
}
