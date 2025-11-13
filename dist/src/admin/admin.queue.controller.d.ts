import { ConfigService } from '@nestjs/config';
export declare class AdminQueueController {
    private readonly config;
    private redis;
    private queues;
    constructor(config: ConfigService);
    getQueueStatus(): Promise<{
        timestamp: string;
        queues: Record<string, any>;
    }>;
}
