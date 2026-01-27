import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../utils/prisma.service';
import { RedisService } from '../utils/redis.service';
import { WsGateway } from '../ws/ws.gateway';
export declare class OrdersStageSlaCron {
    private readonly prisma;
    private readonly redis;
    private readonly ws;
    private readonly config;
    private readonly logger;
    constructor(prisma: PrismaService, redis: RedisService, ws: WsGateway, config: ConfigService);
    private minutes;
    private breachKey;
    private oncePerHour;
    private recordBreach;
    handleStageSlas(): Promise<void>;
}
