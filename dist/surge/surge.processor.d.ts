import { SurgeService } from './surge.service';
export declare class SurgeProcessor {
    private readonly surge;
    private readonly logger;
    private interval;
    constructor(surge: SurgeService);
    onModuleInit(): void;
    tick(): Promise<void>;
    onModuleDestroy(): void;
}
