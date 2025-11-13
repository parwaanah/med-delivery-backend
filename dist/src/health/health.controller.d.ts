import { PrismaService } from '../utils/prisma.service';
import { ConfigService } from '@nestjs/config';
export declare class HealthController {
    private readonly prisma;
    private readonly config;
    constructor(prisma: PrismaService, config: ConfigService);
    getHealth(): Promise<{
        status: string;
        details: Record<string, any>;
    }>;
}
