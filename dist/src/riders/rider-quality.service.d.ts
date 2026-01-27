import { PrismaService } from '../utils/prisma.service';
import { WsGateway } from '../ws/ws.gateway';
import { NotificationService } from '../utils/notification.service';
import { AuditService } from '../utils/audit.service';
export declare class RiderQualityService {
    private readonly prisma;
    private readonly ws;
    private readonly notify;
    private readonly audit;
    private readonly logger;
    constructor(prisma: PrismaService, ws: WsGateway, notify: NotificationService, audit: AuditService);
    private strikeWindowDays;
    private suspendThresholdPoints;
    private rapidRejectWindowSec;
    private rapidRejectThreshold;
    private strikePointsSince;
    private maybeAutoSuspend;
    recordRating(params: {
        customerId: number;
        orderId: number;
        rating: number;
        comment?: string;
    }): Promise<{
        ok: boolean;
    }>;
    addStrike(params: {
        riderId: number;
        type: string;
        points: number;
        reason?: string;
        meta?: any;
    }): Promise<{
        ok: boolean;
    }>;
    addFraudSignal(params: {
        riderId: number;
        type: string;
        severity?: number;
        meta?: any;
        strikePoints?: number;
        reason?: string;
    }): Promise<{
        ok: boolean;
    }>;
    onRiderRejectedOffer(riderId: number): Promise<{
        ok: boolean;
    }>;
    summary(riderId: number): Promise<{
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
