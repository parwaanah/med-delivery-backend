import { Request } from 'express';
import { CartService } from './cart.service';
export declare class CartController {
    private readonly cartService;
    constructor(cartService: CartService);
    addToCart(req: Request, body: {
        medicineId: number;
        quantity?: number;
    }): Promise<{
        id: string;
        quantity: number;
        price: import("@prisma/client/runtime/library").Decimal;
        cartId: string;
        productId: string;
    }>;
    getCart(req: Request): Promise<{
        items: never[];
    } | {
        items: {
            medicine: {
                name: string;
                createdAt: Date;
                id: number;
                price: number | null;
                category: import(".prisma/client").$Enums.MedicineCategory;
                sku: string | null;
                salt: string | null;
                manufacturer: string | null;
                imageUrl: string | null;
                rxType: import(".prisma/client").$Enums.PrescriptionType;
            } | null;
            price: number;
            stock: number;
            pharmacy: string | null;
            pharmacyId: number | null;
            id: string;
            quantity: number;
            cartId: string;
            productId: string;
        }[];
        createdAt: Date;
        id: string;
        userId: string;
        updatedAt: Date;
    }>;
    removeItem(req: Request, body: {
        cartItemId: number;
    }): Promise<{
        id: string;
        quantity: number;
        price: import("@prisma/client/runtime/library").Decimal;
        cartId: string;
        productId: string;
    }>;
    updateQuantity(req: Request, body: {
        cartItemId: number;
        quantity: number;
    }): Promise<{
        id: string;
        quantity: number;
        price: import("@prisma/client/runtime/library").Decimal;
        cartId: string;
        productId: string;
    }>;
    calculateTotal(req: Request, body: any): Promise<{
        baseTotal: any;
        surgeMultiplier: number;
        total: number;
        message: string;
    }>;
    checkout(req: Request, body: any): Promise<{
        orderId: any;
        order: any;
        paymentIntent: {
            mock: boolean;
            razorpayOrder: {
                id: string;
                amount: number;
                currency: string;
                status: string;
            };
            transaction: {
                status: string;
                createdAt: Date;
                id: string;
                method: string | null;
                amount: import("@prisma/client/runtime/library").Decimal;
                currency: string;
                provider: string;
                providerOrder: string | null;
                providerPayment: string | null;
                rawData: import("@prisma/client/runtime/library").JsonValue | null;
                orderId: number | null;
            };
        } | {
            razorpayOrder: any;
            transaction: {
                status: string;
                createdAt: Date;
                id: string;
                method: string | null;
                amount: import("@prisma/client/runtime/library").Decimal;
                currency: string;
                provider: string;
                providerOrder: string | null;
                providerPayment: string | null;
                rawData: import("@prisma/client/runtime/library").JsonValue | null;
                orderId: number | null;
            };
            mock?: undefined;
        };
        message: string;
    }>;
}
