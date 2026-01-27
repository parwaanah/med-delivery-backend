import { RiderPaymentsService } from './rider-payments.service';
export declare class RiderSettlementCron {
    private readonly payments;
    private readonly logger;
    constructor(payments: RiderPaymentsService);
    weekly(): Promise<void>;
    private startOfWeek;
}
