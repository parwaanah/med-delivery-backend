import { Request } from 'express';
import { RiderQualityService } from './rider-quality.service';
export declare class RiderQualityController {
    private readonly quality;
    constructor(quality: RiderQualityService);
    summary(req: Request & {
        user: any;
    }): Promise<{
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
}
