import { RiderQualityService } from '../riders/rider-quality.service';
export declare class AdminRiderQualityController {
    private readonly quality;
    constructor(quality: RiderQualityService);
    qualitySummary(id: string): Promise<{
        riderId: number;
        status: any;
        rating: {
            avg: number;
            count: number;
        };
        strikes: {
            windowDays: number;
            suspendThresholdPoints: number;
            pointsInWindow: number;
            recent: any;
        };
        fraudSignals: any;
    }>;
    addStrike(id: string, body: {
        type: string;
        points?: number;
        reason?: string;
        meta?: any;
    }): Promise<{
        ok: boolean;
    }>;
}
