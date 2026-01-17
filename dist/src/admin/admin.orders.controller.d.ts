import { OrderStatus } from '@prisma/client';
import { OrdersService } from '../orders/orders.service';
import { AuditService } from '../utils/audit.service';
export declare class AdminOrdersController {
    private readonly orders;
    private readonly audit;
    constructor(orders: OrdersService, audit: AuditService);
    forceCancel(id: string, body: {
        reason?: string;
    }, req: any): Promise<{
        createdAt: Date;
        id: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        pharmacyId: number;
        prescriptionId: number | null;
        customerId: number;
        riderId: number | null;
        totalPrice: number;
        paymentMode: import(".prisma/client").$Enums.PaymentMode;
        requiresPrescription: boolean;
    }>;
    forceStatus(id: string, body: {
        status: OrderStatus;
        note?: string;
    }, req: any): Promise<{
        createdAt: Date;
        id: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        pharmacyId: number;
        prescriptionId: number | null;
        customerId: number;
        riderId: number | null;
        totalPrice: number;
        paymentMode: import(".prisma/client").$Enums.PaymentMode;
        requiresPrescription: boolean;
    }>;
    unassignRider(id: string, req: any): Promise<{
        createdAt: Date;
        id: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        pharmacyId: number;
        prescriptionId: number | null;
        customerId: number;
        riderId: number | null;
        totalPrice: number;
        paymentMode: import(".prisma/client").$Enums.PaymentMode;
        requiresPrescription: boolean;
    }>;
    addNote(id: string, body: {
        note: string;
    }, req: any): Promise<{
        ok: boolean;
    }>;
}
