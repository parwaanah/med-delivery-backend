import { OrdersService } from './orders.service';
import { OrderStatus } from '@prisma/client';
import { Request } from 'express';
import { PharmacyAcceptDto } from './dto/pharmacy-accept.dto';
export declare class PharmacyOrdersController {
    private readonly orders;
    constructor(orders: OrdersService);
    list(req: Request & {
        user: any;
    }, status?: OrderStatus): Promise<({
        customer: {
            name: string;
            email: string | null;
            phone: string | null;
            id: number;
        };
        items: {
            name: string;
            id: number;
            medicineId: number | null;
            orderId: number;
            price: number;
            quantity: number;
        }[];
    } & {
        createdAt: Date;
        id: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        customerId: number;
        pharmacyId: number;
        riderId: number | null;
        totalPrice: number;
        paymentMode: import(".prisma/client").$Enums.PaymentMode;
        prescriptionId: number | null;
        requiresPrescription: boolean;
    })[]>;
    get(req: Request & {
        user: any;
    }, id: string): Promise<{
        prescription: {
            createdAt: Date;
            id: number;
            url: string;
            customerId: number;
            verified: boolean;
        } | null;
        customer: {
            name: string;
            email: string | null;
            phone: string | null;
            id: number;
        };
        items: {
            name: string;
            id: number;
            medicineId: number | null;
            orderId: number;
            price: number;
            quantity: number;
        }[];
        timeline: {
            data: string | null;
            createdAt: Date;
            id: number;
            event: string;
            orderId: number;
        }[];
    } & {
        createdAt: Date;
        id: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        updatedAt: Date;
        deletedAt: Date | null;
        customerId: number;
        pharmacyId: number;
        riderId: number | null;
        totalPrice: number;
        paymentMode: import(".prisma/client").$Enums.PaymentMode;
        prescriptionId: number | null;
        requiresPrescription: boolean;
    }>;
    accept(req: Request & {
        user: any;
    }, id: string, body: PharmacyAcceptDto): Promise<{
        order: any;
    }>;
    reject(req: Request & {
        user: any;
    }, id: string, reason?: string): Promise<{
        ok: boolean;
    }>;
    requestPrescription(req: Request & {
        user: any;
    }, id: string, message?: string): Promise<{
        ok: boolean;
    }>;
    markReady(req: Request & {
        user: any;
    }, id: string): Promise<{
        order: any;
    }>;
    confirmHandover(req: Request & {
        user: any;
    }, id: string): Promise<{
        order: any;
    }>;
    verifyPrescription(req: Request & {
        user: any;
    }, id: string): Promise<{
        ok: boolean;
        verified: boolean;
    }>;
}
