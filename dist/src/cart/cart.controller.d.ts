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
            rzpOrder: any;
            transaction: {
                status: string;
                createdAt: Date;
                id: string;
                orderId: number | null;
                amount: import("@prisma/client/runtime/library").Decimal;
                currency: string;
                method: string | null;
                provider: string;
                providerOrder: string | null;
                providerPayment: string | null;
                rawData: import("@prisma/client/runtime/library").JsonValue | null;
            };
        };
        message: string;
    }>;
}
