import { SurgeService } from './surge.service';
export declare class SurgeController {
    private readonly surge;
    constructor(surge: SurgeService);
    status(): Promise<{
        multiplier: number;
        demand: number;
        supply: number;
        override: number | null;
    }>;
    override(body: any): Promise<{
        multiplier: number;
        demand: number;
        supply: number;
    }>;
    reset(): Promise<{
        multiplier: number;
        demand: number;
        supply: number;
    } | {
        multiplier: number;
        error: string;
    }>;
}
