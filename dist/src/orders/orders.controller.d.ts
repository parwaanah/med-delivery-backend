import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Request } from 'express';
import { OrderStatus } from '@prisma/client';
import { RateRiderDto } from './dto/rate-rider.dto';
export declare class OrdersController {
    private readonly ordersService;
    constructor(ordersService: OrdersService);
    create(req: Request & {
        user: any;
    }, dto: CreateOrderDto): Promise<({
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
    }) | {
        order: {
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
        };
        candidates: any[];
        scores: {
            pharmacyId: any;
            score: number;
        }[];
    }>;
    uploadPrescription(req: Request & {
        user: any;
    }, id: string, url: string): Promise<{
        createdAt: Date;
        id: number;
        url: string;
        customerId: number;
        verified: boolean;
    }>;
    requestPrescription(req: Request & {
        user: any;
    }, orderId: string, dto: {
        message?: string;
    }): Promise<{
        ok: boolean;
    }>;
    pharmacyRespond(req: Request & {
        user: any;
    }, orderId: string, dto: {
        action: 'ACCEPTED' | 'REJECTED';
    }): Promise<any>;
    riderRespond(req: Request & {
        user: any;
    }, orderId: string, dto: {
        action: 'ACCEPTED' | 'REJECTED';
        reason?: string;
    }): Promise<{
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
    } | {
        ok: boolean;
    }>;
    riderIssue(req: Request & {
        user: any;
    }, orderId: string, dto: {
        type: 'CUSTOMER_UNREACHABLE' | 'ADDRESS_ISSUE' | 'PAYMENT_ISSUE' | 'OTHER';
        note?: string;
        lat?: number;
        lng?: number;
    }): Promise<{
        ok: boolean;
    }>;
    updateStage(req: Request & {
        user: any;
    }, orderId: string, dto: {
        stage: OrderStatus;
        lat?: number;
        lng?: number;
        proofUrl?: string;
        signatureUrl?: string;
        otp?: string;
    }): Promise<{
        ok: boolean;
    }>;
    rateRider(req: Request & {
        user: any;
    }, orderId: string, dto: RateRiderDto): Promise<{
        ok: boolean;
    }>;
    list(req: Request & {
        user: any;
    }): Promise<({
        prescription: {
            createdAt: Date;
            id: number;
            url: string;
            customerId: number;
            verified: boolean;
        } | null;
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
    getTimeline(req: Request & {
        user: any;
    }, orderId: string): Promise<{
        event: string;
        data: any;
        at: Date;
    }[]>;
    confirmChanges(req: Request & {
        user: any;
    }, orderId: string): Promise<{
        order: any;
    }>;
    rejectChanges(req: Request & {
        user: any;
    }, orderId: string, body: {
        reason?: string;
    }): Promise<{
        order: any;
    }>;
}
