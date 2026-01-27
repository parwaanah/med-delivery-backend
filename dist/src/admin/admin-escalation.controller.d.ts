import { PrismaService } from '../utils/prisma.service';
import { EscalationService } from './escalation.service';
import { OrdersService } from '../orders/orders.service';
export declare class AdminEscalationController {
    private readonly prisma;
    private readonly esc;
    private readonly orders;
    constructor(prisma: PrismaService, esc: EscalationService, orders: OrdersService);
    getEscalated(): Promise<{
        total: number;
        items: any[];
    }>;
    getCandidates(id: string): Promise<{
        total: number;
        candidates: ({
            user: {
                name: string;
                email: string | null;
                id: number;
                status: string;
                latitude: number | null;
                longitude: number | null;
            } | null;
            riderId: null;
            score: number;
            distKm: number | null;
            meta: any;
        } | {
            user: {
                name: string;
                email: string | null;
                id: number;
                status: string;
                latitude: number | null;
                longitude: number | null;
            } | null;
            riderId: number;
            score: number;
            distKm: number | null;
            meta: any;
        })[];
    }>;
    assign(id: string, riderId: string, req: any): Promise<any>;
}
