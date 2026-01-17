import { PrismaService } from '../utils/prisma.service';
import { OrdersService } from '../orders/orders.service';
export declare class CartService {
    private readonly prisma;
    private readonly orders;
    constructor(prisma: PrismaService, orders: OrdersService);
    addToCart(userId: string, medicineId: number, quantity: number): Promise<{
        id: string;
        quantity: number;
        price: import("@prisma/client/runtime/library").Decimal;
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
                price: number | null;
                category: import(".prisma/client").$Enums.MedicineCategory;
                sku: string | null;
                salt: string | null;
                manufacturer: string | null;
                imageUrl: string | null;
                rxType: import(".prisma/client").$Enums.PrescriptionType;
            } | null;
            stock: number;
            pharmacy: string | null;
            pharmacyId: number | null;
        }[];
    }>;
    removeItem(userId: string, cartItemId: string): Promise<{
        id: string;
        quantity: number;
        price: import("@prisma/client/runtime/library").Decimal;
        cartId: string;
        productId: string;
    }>;
    updateQuantity(userId: string, cartItemId: string, quantity: number): Promise<{
        id: string;
        quantity: number;
        price: import("@prisma/client/runtime/library").Decimal;
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
            quantity: number;
            price: number;
            orderId: number;
        }[];
    } & {
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
    }) | {
        order: {
            items: {
                name: string;
                id: number;
                medicineId: number | null;
                quantity: number;
                price: number;
                orderId: number;
            }[];
        } & {
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
        };
        payment: {
            mock: boolean;
            status: string;
            id: string;
        };
        candidates?: undefined;
        scores?: undefined;
    } | {
        order: {
            items: {
                name: string;
                id: number;
                medicineId: number | null;
                quantity: number;
                price: number;
                orderId: number;
            }[];
        } & {
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
        };
        payment: {
            mock: boolean;
            transaction: {
                createdAt: Date;
                id: string;
                status: string;
                method: string | null;
                amount: import("@prisma/client/runtime/library").Decimal;
                currency: string;
                provider: string;
                providerOrder: string | null;
                providerPayment: string | null;
                rawData: import("@prisma/client/runtime/library").JsonValue | null;
                orderId: number | null;
            };
            razorpayOrder?: undefined;
        } | {
            razorpayOrder: any;
            transaction: {
                createdAt: Date;
                id: string;
                status: string;
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
        candidates?: undefined;
        scores?: undefined;
    } | {
        order: {
            items: {
                name: string;
                id: number;
                medicineId: number | null;
                quantity: number;
                price: number;
                orderId: number;
            }[];
        } & {
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
        };
        candidates: number[];
        scores: {
            pharmacyId: number;
            score: number;
        }[];
        payment: {
            mock: boolean;
            status: string;
            id: string;
        };
    } | {
        order: {
            items: {
                name: string;
                id: number;
                medicineId: number | null;
                quantity: number;
                price: number;
                orderId: number;
            }[];
        } & {
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
        };
        candidates: number[];
        scores: {
            pharmacyId: number;
            score: number;
        }[];
        payment?: undefined;
    } | {
        order: {
            items: {
                name: string;
                id: number;
                medicineId: number | null;
                quantity: number;
                price: number;
                orderId: number;
            }[];
        } & {
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
        };
        candidates: number[];
        scores: {
            pharmacyId: number;
            score: number;
        }[];
        payment: {
            mock: boolean;
            transaction: {
                createdAt: Date;
                id: string;
                status: string;
                method: string | null;
                amount: import("@prisma/client/runtime/library").Decimal;
                currency: string;
                provider: string;
                providerOrder: string | null;
                providerPayment: string | null;
                rawData: import("@prisma/client/runtime/library").JsonValue | null;
                orderId: number | null;
            };
            razorpayOrder?: undefined;
        } | {
            razorpayOrder: any;
            transaction: {
                createdAt: Date;
                id: string;
                status: string;
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
    }>;
}
