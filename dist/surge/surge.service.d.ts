import { PrismaService } from '../utils/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SurgeLiveGateway } from '../ws/surge-live.gateway';
export declare class SurgeService {
    private readonly prisma;
    private readonly config;
    private readonly surgeGateway;
    private readonly logger;
    private redis;
    private readonly windowMs;
    private readonly baseMultiplier;
    private currentMultiplier;
    private overrideValue;
    private readonly historyKey;
    private readonly demandKey;
    private readonly supplyKey;
    constructor(prisma: PrismaService, config: ConfigService, surgeGateway: SurgeLiveGateway);
    incrementDemand(by?: number): Promise<{
        multiplier: number;
        demand: number;
        supply: number;
    } | {
        multiplier: number;
        error: string;
    }>;
    recordRiderAvailability(riderId: number, available: boolean): Promise<{
        multiplier: number;
        demand: number;
        supply: number;
    } | {
        multiplier: number;
        error: string;
    }>;
    private recalculate;
    private trimHistory;
    private broadcast;
    overrideMultiplier(multiplier: number, meta?: any): Promise<{
        multiplier: number;
        demand: number;
        supply: number;
    }>;
    clearOverride(): Promise<{
        multiplier: number;
        demand: number;
        supply: number;
    } | {
        multiplier: number;
        error: string;
    }>;
    getStatus(): Promise<{
        multiplier: number;
        demand: number;
        supply: number;
        override: number | null;
    }>;
}
