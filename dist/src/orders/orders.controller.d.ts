import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Request } from 'express';
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
            quantity: number;
            price: number;
            orderId: number;
        }[];
    } & {
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
        id: number;
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
            status: import(".prisma/client").$Enums.OrderStatus;
            createdAt: Date;
            id: number;
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
            status: import(".prisma/client").$Enums.OrderStatus;
            createdAt: Date;
            id: number;
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
            status: import(".prisma/client").$Enums.OrderStatus;
            createdAt: Date;
            id: number;
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
            status: import(".prisma/client").$Enums.OrderStatus;
            createdAt: Date;
            id: number;
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
            status: import(".prisma/client").$Enums.OrderStatus;
            createdAt: Date;
            id: number;
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
    }>;
    uploadPrescription(req: Request & {
        user: any;
    }, id: string, url: string): Promise<{
        createdAt: Date;
        id: number;
        customerId: number;
        url: string;
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
    }): Promise<{
        ok: boolean;
        order?: undefined;
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
            status: import(".prisma/client").$Enums.OrderStatus;
            createdAt: Date;
            id: number;
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
        };
        ok?: undefined;
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
            status: import(".prisma/client").$Enums.OrderStatus;
            createdAt: Date;
            id: number;
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
        ok?: undefined;
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
            status: import(".prisma/client").$Enums.OrderStatus;
            createdAt: Date;
            id: number;
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
        ok?: undefined;
        payment?: undefined;
    }>;
    riderRespond(req: Request & {
        user: any;
    }, orderId: string, dto: {
        action: 'ACCEPTED' | 'REJECTED';
    }): Promise<{
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
        id: number;
        updatedAt: Date;
        deletedAt: Date | null;
        pharmacyId: number;
        prescriptionId: number | null;
        customerId: number;
        riderId: number | null;
        totalPrice: number;
        paymentMode: import(".prisma/client").$Enums.PaymentMode;
        requiresPrescription: boolean;
    } | {
        ok: boolean;
    }>;
    updateStage(req: Request & {
        user: any;
    }, orderId: string, dto: {
        stage: string;
        lat?: number;
        lng?: number;
    }): Promise<{
        ok: boolean;
    }>;
    list(req: Request & {
        user: any;
    }): Promise<({
        prescription: {
            createdAt: Date;
            id: number;
            customerId: number;
            url: string;
            verified: boolean;
        } | null;
        items: {
            name: string;
            id: number;
            medicineId: number | null;
            quantity: number;
            price: number;
            orderId: number;
        }[];
    } & {
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
        id: number;
        updatedAt: Date;
        deletedAt: Date | null;
        pharmacyId: number;
        prescriptionId: number | null;
        customerId: number;
        riderId: number | null;
        totalPrice: number;
        paymentMode: import(".prisma/client").$Enums.PaymentMode;
        requiresPrescription: boolean;
    })[]>;
    getTimeline(orderId: string): Promise<{
        event: string;
        data: any;
        at: Date;
    }[]>;
}
