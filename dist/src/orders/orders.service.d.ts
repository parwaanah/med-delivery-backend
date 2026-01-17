import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Queue } from 'bullmq';
import { WsGateway } from '../ws/ws.gateway';
import { ConfigService } from '@nestjs/config';
import { SurgeService } from '../surge/surge.service';
import { GeoSurgeService } from '../geosurge/geo-surge.service';
import { PaymentsService } from '../payments/payments.service';
import { OrderStatus } from '@prisma/client';
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
    private isEscalatable;
    private toRad;
    private haversineKm;
    private logTimeline;
    private resolveModeFromItems;
    private getAnyPharmacyId;
    createOrder(customerId: number, dto: CreateOrderDto): Promise<({
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
    uploadPrescription(customerId: number, url: string, attachOrderId?: number): Promise<{
        createdAt: Date;
        id: number;
        url: string;
        verified: boolean;
        customerId: number;
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
        ok?: undefined;
        payment?: undefined;
    }>;
    riderRespond(riderId: number, orderId: number, action: 'ACCEPTED' | 'REJECTED'): Promise<{
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
    } | {
        ok: boolean;
    }>;
    adminAssign(orderId: number, adminId: number, riderId: number): Promise<{
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
    }>;
    updateStage(riderId: number, orderId: number, stage: OrderStatus, location?: {
        lat?: number;
        lng?: number;
    }): Promise<{
        ok: boolean;
    }>;
    findByUser(userId: number, role: string): Promise<({
        prescription: {
            createdAt: Date;
            id: number;
            url: string;
            verified: boolean;
            customerId: number;
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
    adminForceCancel(orderId: number, reason?: string): Promise<{
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
    }>;
    adminForceStatus(orderId: number, status: OrderStatus, note?: string): Promise<{
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
    }>;
    adminUnassignRider(orderId: number): Promise<{
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
    }>;
    adminAddNote(orderId: number, note: string): Promise<{
        ok: boolean;
    }>;
}
