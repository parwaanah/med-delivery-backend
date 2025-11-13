import { OnGatewayInit } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { PrismaService } from '../utils/prisma.service';
import { ConfigService } from '@nestjs/config';
export declare class HealthLiveGateway implements OnGatewayInit {
    private readonly prisma;
    private readonly config;
    server: Server;
    private redisUrl;
    constructor(prisma: PrismaService, config: ConfigService);
    afterInit(): void;
    private startBroadcastLoop;
    private checkSystemHealth;
}
