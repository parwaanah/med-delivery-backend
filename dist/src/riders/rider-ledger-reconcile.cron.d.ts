import { PrismaService } from '../utils/prisma.service';
import { RiderPaymentsService } from './rider-payments.service';
export declare class RiderLedgerReconcileCron {
    private readonly prisma;
    private readonly riderPayments;
    private readonly logger;
    constructor(prisma: PrismaService, riderPayments: RiderPaymentsService);
    reconcile(): Promise<void>;
}
