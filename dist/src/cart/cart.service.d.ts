import { PrismaService } from '../utils/prisma.service';
import { SurgeService } from '../surge/surge.service';
import { PaymentsService } from '../payments/payments.service';
import { OrdersService } from '../orders/orders.service';
export declare class CartService {
    private prisma;
    private surge;
    private payments;
    private orders;
    constructor(prisma: PrismaService, surge: SurgeService, payments: PaymentsService, orders: OrdersService);
    addToCart(userId: number, medicineId: number, quantity: number): Promise<{
        id: string;
        quantity: number;
        price: import("@prisma/client/runtime/library").Decimal;
        cartId: string;
        productId: string;
    }>;
    getCart(userId: number): Promise<{
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
    removeItem(userId: number, cartItemId: number): Promise<{
        id: string;
        quantity: number;
        price: import("@prisma/client/runtime/library").Decimal;
        cartId: string;
        productId: string;
    }>;
    updateQuantity(userId: number, cartItemId: number, quantity: number): Promise<{
        id: string;
        quantity: number;
        price: import("@prisma/client/runtime/library").Decimal;
        cartId: string;
        productId: string;
    }>;
    calculateTotal(userId: number, items: any[]): Promise<{
        baseTotal: any;
        surgeMultiplier: number;
        total: number;
        message: string;
    }>;
    checkout(userId: number, dtoItems: any[], opts?: {
        pharmacyId?: number;
        pickupLat?: number;
        pickupLon?: number;
    }): Promise<{
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
