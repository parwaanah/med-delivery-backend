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
    constructor(prisma: PrismaService, notify: NotificationService, ws: WsGateway, config: ConfigService, surge: SurgeService, geoSurge: GeoSurgeService, payments: PaymentsService, orderAssignQueue: Queue);
    private haversineKm;
    private estimateEtaMinutes;
    private computePharmacyScore;
    private computeRiderScore;
    createOrder(customerId: number, dto: CreateOrderDto): Promise<({
        items: {
            id: number;
            orderId: number;
            name: string;
            quantity: number;
            price: number;
            medicineId: number | null;
        }[];
    } & {
        id: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
        customerId: number;
        pharmacyId: number;
        riderId: number | null;
        totalPrice: number;
        updatedAt: Date;
        deletedAt: Date | null;
    }) | {
        order: {
            items: {
                id: number;
                orderId: number;
                name: string;
                quantity: number;
                price: number;
                medicineId: number | null;
            }[];
        } & {
            id: number;
            status: import(".prisma/client").$Enums.OrderStatus;
            createdAt: Date;
            customerId: number;
            pharmacyId: number;
            riderId: number | null;
            totalPrice: number;
            updatedAt: Date;
            deletedAt: Date | null;
        };
        candidates: number[];
        scores: {
            pharmacyId: number;
            score: number;
        }[];
    }>;
    updateStage(riderId: number, orderId: number, stage: 'REACHED_PHARMACY' | 'PICKED_UP' | 'DELIVERED', location?: {
        lat: number;
        lng: number;
    }): Promise<{
        ok: boolean;
    }>;
    adminAssign(orderId: number, adminId: number, riderId: number): Promise<{
        id: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
        customerId: number;
        pharmacyId: number;
        riderId: number | null;
        totalPrice: number;
        updatedAt: Date;
        deletedAt: Date | null;
    }>;
    pharmacyRespond(pharmacyId: number, orderId: number, action: 'ACCEPTED' | 'REJECTED'): Promise<{
        ok: boolean;
        order?: undefined;
        payment?: undefined;
        paymentError?: undefined;
    } | {
        order: {
            id: number;
            status: import(".prisma/client").$Enums.OrderStatus;
            createdAt: Date;
            customerId: number;
            pharmacyId: number;
            riderId: number | null;
            totalPrice: number;
            updatedAt: Date;
            deletedAt: Date | null;
        };
        payment: {
            rzpOrder: any;
            transaction: {
                amount: import("@prisma/client/runtime/library").Decimal;
                currency: string;
                method: string | null;
                id: string;
                orderId: number | null;
                provider: string;
                providerOrder: string | null;
                providerPayment: string | null;
                status: string;
                rawData: import("@prisma/client/runtime/library").JsonValue | null;
                createdAt: Date;
            };
        };
        ok?: undefined;
        paymentError?: undefined;
    } | {
        order: {
            id: number;
            status: import(".prisma/client").$Enums.OrderStatus;
            createdAt: Date;
            customerId: number;
            pharmacyId: number;
            riderId: number | null;
            totalPrice: number;
            updatedAt: Date;
            deletedAt: Date | null;
        };
        paymentError: any;
        ok?: undefined;
        payment?: undefined;
    }>;
    riderRespond(riderId: number, orderId: number, action: 'ACCEPTED' | 'REJECTED'): Promise<{
        id: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
        customerId: number;
        pharmacyId: number;
        riderId: number | null;
        totalPrice: number;
        updatedAt: Date;
        deletedAt: Date | null;
    } | {
        ok: boolean;
    }>;
    findByUser(userId: number, role: string): Promise<({
        items: {
            id: number;
            orderId: number;
            name: string;
            quantity: number;
            price: number;
            medicineId: number | null;
        }[];
    } & {
        id: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
        customerId: number;
        pharmacyId: number;
        riderId: number | null;
        totalPrice: number;
        updatedAt: Date;
        deletedAt: Date | null;
    })[]>;
}
