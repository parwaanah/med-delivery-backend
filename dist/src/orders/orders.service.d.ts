import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Queue } from 'bullmq';
import { WsGateway } from '../ws/ws.gateway';
import { ConfigService } from '@nestjs/config';
import { SurgeService } from '../surge/surge.service';
import { GeoSurgeService } from '../geosurge/geo-surge.service';
import { PaymentsService } from '../payments/payments.service';
export declare class OrdersService {
    private prisma;
    private notify;
    private ws;
    private config;
    private surge;
    private geoSurge;
    private payments;
    private orderAssignQueue;
    private readonly logger;
    private readonly defaultRiderSearchKm;
    private readonly riderSpeedKmPerHr;
    private readonly isLoadtest;
    constructor(prisma: PrismaService, notify: NotificationService, ws: WsGateway, config: ConfigService, surge: SurgeService, geoSurge: GeoSurgeService, payments: PaymentsService, orderAssignQueue: Queue);
    private toRad;
    private haversineKm;
    private logTimeline;
    private resolveModeFromItems;
    private getAnyPharmacyId;
    createOrder(customerId: number, dto: CreateOrderDto): Promise<({
        items: {
            id: number;
            name: string;
            quantity: number;
            price: number;
            medicineId: number | null;
            orderId: number;
        }[];
    } & {
        status: import(".prisma/client").$Enums.OrderStatus;
        totalPrice: number;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        paymentMode: import(".prisma/client").$Enums.PaymentMode;
        requiresPrescription: boolean;
        id: number;
        customerId: number;
        pharmacyId: number;
        riderId: number | null;
        prescriptionId: number | null;
    }) | {
        order: {
            items: {
                id: number;
                name: string;
                quantity: number;
                price: number;
                medicineId: number | null;
                orderId: number;
            }[];
        } & {
            status: import(".prisma/client").$Enums.OrderStatus;
            totalPrice: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            paymentMode: import(".prisma/client").$Enums.PaymentMode;
            requiresPrescription: boolean;
            id: number;
            customerId: number;
            pharmacyId: number;
            riderId: number | null;
            prescriptionId: number | null;
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
                id: number;
                name: string;
                quantity: number;
                price: number;
                medicineId: number | null;
                orderId: number;
            }[];
        } & {
            status: import(".prisma/client").$Enums.OrderStatus;
            totalPrice: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            paymentMode: import(".prisma/client").$Enums.PaymentMode;
            requiresPrescription: boolean;
            id: number;
            customerId: number;
            pharmacyId: number;
            riderId: number | null;
            prescriptionId: number | null;
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
        candidates?: undefined;
        scores?: undefined;
    } | {
        order: {
            items: {
                id: number;
                name: string;
                quantity: number;
                price: number;
                medicineId: number | null;
                orderId: number;
            }[];
        } & {
            status: import(".prisma/client").$Enums.OrderStatus;
            totalPrice: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            paymentMode: import(".prisma/client").$Enums.PaymentMode;
            requiresPrescription: boolean;
            id: number;
            customerId: number;
            pharmacyId: number;
            riderId: number | null;
            prescriptionId: number | null;
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
                id: number;
                name: string;
                quantity: number;
                price: number;
                medicineId: number | null;
                orderId: number;
            }[];
        } & {
            status: import(".prisma/client").$Enums.OrderStatus;
            totalPrice: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            paymentMode: import(".prisma/client").$Enums.PaymentMode;
            requiresPrescription: boolean;
            id: number;
            customerId: number;
            pharmacyId: number;
            riderId: number | null;
            prescriptionId: number | null;
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
                id: number;
                name: string;
                quantity: number;
                price: number;
                medicineId: number | null;
                orderId: number;
            }[];
        } & {
            status: import(".prisma/client").$Enums.OrderStatus;
            totalPrice: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            paymentMode: import(".prisma/client").$Enums.PaymentMode;
            requiresPrescription: boolean;
            id: number;
            customerId: number;
            pharmacyId: number;
            riderId: number | null;
            prescriptionId: number | null;
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
    }>;
    uploadPrescription(customerId: number, url: string, attachOrderId?: number): Promise<{
        createdAt: Date;
        id: number;
        customerId: number;
        url: string;
        verified: boolean;
    }>;
    pharmacyRequestPrescription(pharmacyId: number, orderId: number, message?: string): Promise<{
        ok: boolean;
    }>;
    pharmacyRespond(pharmacyId: number, orderId: number, action: 'ACCEPTED' | 'REJECTED'): Promise<{
        ok: boolean;
        order?: undefined;
        payment?: undefined;
    } | {
        order: {
            items: {
                id: number;
                name: string;
                quantity: number;
                price: number;
                medicineId: number | null;
                orderId: number;
            }[];
        } & {
            status: import(".prisma/client").$Enums.OrderStatus;
            totalPrice: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            paymentMode: import(".prisma/client").$Enums.PaymentMode;
            requiresPrescription: boolean;
            id: number;
            customerId: number;
            pharmacyId: number;
            riderId: number | null;
            prescriptionId: number | null;
        };
        payment: {
            mock: boolean;
            status: string;
        };
        ok?: undefined;
    } | {
        order: {
            items: {
                id: number;
                name: string;
                quantity: number;
                price: number;
                medicineId: number | null;
                orderId: number;
            }[];
        } & {
            status: import(".prisma/client").$Enums.OrderStatus;
            totalPrice: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            paymentMode: import(".prisma/client").$Enums.PaymentMode;
            requiresPrescription: boolean;
            id: number;
            customerId: number;
            pharmacyId: number;
            riderId: number | null;
            prescriptionId: number | null;
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
        ok?: undefined;
    } | {
        order: {
            items: {
                id: number;
                name: string;
                quantity: number;
                price: number;
                medicineId: number | null;
                orderId: number;
            }[];
        } & {
            status: import(".prisma/client").$Enums.OrderStatus;
            totalPrice: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            paymentMode: import(".prisma/client").$Enums.PaymentMode;
            requiresPrescription: boolean;
            id: number;
            customerId: number;
            pharmacyId: number;
            riderId: number | null;
            prescriptionId: number | null;
        };
        ok?: undefined;
        payment?: undefined;
    }>;
    riderRespond(riderId: number, orderId: number, action: 'ACCEPTED' | 'REJECTED'): Promise<{
        status: import(".prisma/client").$Enums.OrderStatus;
        totalPrice: number;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        paymentMode: import(".prisma/client").$Enums.PaymentMode;
        requiresPrescription: boolean;
        id: number;
        customerId: number;
        pharmacyId: number;
        riderId: number | null;
        prescriptionId: number | null;
    } | {
        ok: boolean;
    }>;
    adminAssign(orderId: number, adminId: number, riderId: number): Promise<{
        status: import(".prisma/client").$Enums.OrderStatus;
        totalPrice: number;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        paymentMode: import(".prisma/client").$Enums.PaymentMode;
        requiresPrescription: boolean;
        id: number;
        customerId: number;
        pharmacyId: number;
        riderId: number | null;
        prescriptionId: number | null;
    }>;
    updateStage(riderId: number, orderId: number, stage: any, location?: {
        lat?: number;
        lng?: number;
    }): Promise<{
        ok: boolean;
    }>;
    findByUser(userId: number, role: string): Promise<({
        prescription: {
            createdAt: Date;
            id: number;
            customerId: number;
            url: string;
            verified: boolean;
        } | null;
        items: {
            id: number;
            name: string;
            quantity: number;
            price: number;
            medicineId: number | null;
            orderId: number;
        }[];
    } & {
        status: import(".prisma/client").$Enums.OrderStatus;
        totalPrice: number;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        paymentMode: import(".prisma/client").$Enums.PaymentMode;
        requiresPrescription: boolean;
        id: number;
        customerId: number;
        pharmacyId: number;
        riderId: number | null;
        prescriptionId: number | null;
    })[]>;
    getTimeline(orderId: number): Promise<{
        event: string;
        data: any;
        at: Date;
    }[]>;
    getRiderScorePublic(rp: {
        memberId: string;
        distKm?: number;
        meta?: any;
    }, lat?: number | null, lon?: number | null): Promise<number>;
}
