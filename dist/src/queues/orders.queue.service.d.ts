import { ConfigService } from '@nestjs/config';
export declare class OrdersQueueService {
    private config;
    private queue;
    private readonly logger;
    constructor(config: ConfigService);
    addRiderEscalation(orderId: number, delayMs?: number): Promise<void>;
}
