import { Request } from 'express';
import { CartService } from './cart.service';
export declare class CartController {
    private readonly cartService;
    constructor(cartService: CartService);
    add(req: Request, body: {
        medicineId: number;
        quantity?: number;
    }): Promise<{
        id: string;
        price: import("@prisma/client/runtime/library").Decimal;
        quantity: number;
        cartId: string;
        productId: string;
    }>;
    get(req: Request): Promise<{
        items: never[];
        id?: undefined;
    } | {
        id: string;
        items: {
            id: string;
            quantity: number;
            price: number;
            medicine: {
                name: string;
                createdAt: Date;
                id: number;
                sku: string | null;
                salt: string | null;
                manufacturer: string | null;
                price: number | null;
                imageUrl: string | null;
                category: import(".prisma/client").$Enums.MedicineCategory;
                rxType: import(".prisma/client").$Enums.PrescriptionType;
            } | null;
            stock: number;
            pharmacy: string | null;
            pharmacyId: number | null;
        }[];
    }>;
    remove(req: Request, body: {
        cartItemId: string;
    }): Promise<{
        id: string;
        price: import("@prisma/client/runtime/library").Decimal;
        quantity: number;
        cartId: string;
        productId: string;
    }>;
    update(req: Request, body: {
        cartItemId: string;
        quantity: number;
    }): Promise<{
        id: string;
        price: import("@prisma/client/runtime/library").Decimal;
        quantity: number;
        cartId: string;
        productId: string;
    }>;
    checkout(req: Request, body: {
        notes?: string;
    }): Promise<({
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
}
