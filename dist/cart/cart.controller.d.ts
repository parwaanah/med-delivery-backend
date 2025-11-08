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
