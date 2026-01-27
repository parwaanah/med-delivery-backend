import { PrismaService } from '../utils/prisma.service';
import { OrdersService } from '../orders/orders.service';
export declare class CartService {
    private readonly prisma;
    private readonly orders;
    constructor(prisma: PrismaService, orders: OrdersService);
    addToCart(userId: string, medicineId: number, quantity: number): Promise<{
        id: string;
        price: import("@prisma/client/runtime/library").Decimal;
        quantity: number;
        cartId: string;
        productId: string;
    }>;
    getCart(userId: string): Promise<{
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
    removeItem(userId: string, cartItemId: string): Promise<{
        id: string;
        price: import("@prisma/client/runtime/library").Decimal;
        quantity: number;
        cartId: string;
        productId: string;
    }>;
    updateQuantity(userId: string, cartItemId: string, quantity: number): Promise<{
        id: string;
        price: import("@prisma/client/runtime/library").Decimal;
        quantity: number;
        cartId: string;
        productId: string;
    }>;
    checkout(userId: string, body: {
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
