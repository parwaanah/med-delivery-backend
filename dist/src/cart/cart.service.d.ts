import { PrismaService } from '../utils/prisma.service';
import { SurgeService } from '../surge/surge.service';
import { PaymentsService } from '../payment/payments.service';
export declare class CartService {
    private prisma;
    private surge;
    private payments;
    constructor(prisma: PrismaService, surge: SurgeService, payments: PaymentsService);
    calculateTotal(userId: number, items: any[]): Promise<{
        baseTotal: any;
        surgeMultiplier: number;
        total: number;
        message: string;
    }>;
    checkout(userId: number, items: any[]): Promise<{
        paymentIntent: {
            clientSecret: string | null;
            id: string;
            amount: number;
        };
        baseTotal: any;
        surgeMultiplier: number;
        total: number;
        message: string;
    }>;
}
