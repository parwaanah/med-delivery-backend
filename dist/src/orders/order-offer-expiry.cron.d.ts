import { PrismaService } from '../utils/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
export declare class OrderOfferExpiryCron {
    private readonly prisma;
    private readonly config;
    private readonly orderAssignQueue;
    private readonly logger;
    constructor(prisma: PrismaService, config: ConfigService, orderAssignQueue: Queue);
    private takeLimit;
    expireOffers(): Promise<void>;
}
