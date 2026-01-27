import { PrismaService } from '../utils/prisma.service';
import { RiderPaymentsService } from '../riders/rider-payments.service';
export declare class AdminRiderSettlementsController {
    private readonly prisma;
    private readonly payments;
    constructor(prisma: PrismaService, payments: RiderPaymentsService);
    listBatches(limit?: string): Promise<{
        items: any;
        take: number;
    }>;
    batch(id: string): Promise<any>;
    createBatch(body: {
        periodStart: string;
        periodEnd: string;
    }, req: any): Promise<any>;
    markPaid(id: string, req: any): Promise<any>;
    listEarnings(riderId?: string, status?: string, limit?: string): Promise<{
        items: any;
        take: number;
    }>;
    overrideEarning(id: string, body: {
        bonus?: number;
        penalty?: number;
    }): Promise<any>;
}
