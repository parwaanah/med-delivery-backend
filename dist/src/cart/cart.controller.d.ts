import { Request } from 'express';
import { CartService } from './cart.service';
export declare class CartController {
    private readonly cartService;
    constructor(cartService: CartService);
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
                provider: string;
                providerOrder: string | null;
                providerPayment: string | null;
                amount: import("@prisma/client/runtime/library").Decimal;
                currency: string;
                method: string | null;
                rawData: import("@prisma/client/runtime/library").JsonValue | null;
                orderId: number | null;
            };
        } | {
            razorpayOrder: any;
            transaction: {
                status: string;
                createdAt: Date;
                id: string;
                provider: string;
                providerOrder: string | null;
                providerPayment: string | null;
                amount: import("@prisma/client/runtime/library").Decimal;
                currency: string;
                method: string | null;
                rawData: import("@prisma/client/runtime/library").JsonValue | null;
                orderId: number | null;
            };
            mock?: undefined;
        };
        message: string;
    }>;
}
