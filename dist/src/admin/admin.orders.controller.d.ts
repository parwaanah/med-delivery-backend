import { OrderStatus } from '@prisma/client';
import { OrdersService } from '../orders/orders.service';
import { AuditService } from '../utils/audit.service';
export declare class AdminOrdersController {
    private readonly orders;
    private readonly audit;
    constructor(orders: OrdersService, audit: AuditService);
    forceCancel(id: string, body: {
        reason?: string;
    }, req: any): Promise<any>;
    forceStatus(id: string, body: {
        status: OrderStatus;
        note?: string;
    }, req: any): Promise<any>;
    unassignRider(id: string, req: any): Promise<any>;
    addNote(id: string, body: {
        note: string;
    }, req: any): Promise<{
        ok: boolean;
    }>;
    settle(id: string, body: {
        note?: string;
        force?: boolean;
    }, req: any): Promise<{
        ok: boolean;
        orderId: number;
        settled: boolean;
        already: boolean;
        settledAt: Date | null;
    } | {
        ok: boolean;
        orderId: number;
        settled: boolean;
        already?: undefined;
        settledAt?: undefined;
    }>;
    unsettle(id: string, body: {
        note?: string;
    }, req: any): Promise<{
        ok: boolean;
        orderId: number;
        settled: boolean;
        already: boolean;
    } | {
        ok: boolean;
        orderId: number;
        settled: boolean;
        already?: undefined;
    }>;
    verifyPrescription(id: string, req: any): Promise<{
        ok: boolean;
        verified: boolean;
    }>;
}
