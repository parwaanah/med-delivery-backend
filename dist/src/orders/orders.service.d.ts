import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Queue } from 'bullmq';
import { WsGateway } from '../ws/ws.gateway';
import { ConfigService } from '@nestjs/config';
import { SurgeService } from '../surge/surge.service';
import { GeoSurgeService } from '../geosurge/geo-surge.service';
import { PaymentsService } from '../payments/payments.service';
import { PharmacyAcceptDto } from './dto/pharmacy-accept.dto';
import { RiderPaymentsService } from '../riders/rider-payments.service';
import { RiderQualityService } from '../riders/rider-quality.service';
import { OrderLifecycleService } from './order-lifecycle.service';
import { OrderStatus } from '@prisma/client';
import { ServiceAreaService } from '../service-area/service-area.service';
export declare class OrdersService {
    private prisma;
    private notify;
    private ws;
    private config;
    private surge;
    private geoSurge;
    private payments;
    private readonly riderPayments;
    private readonly riderQuality;
    private readonly lifecycle;
    private readonly serviceArea;
    private orderAssignQueue;
    private readonly logger;
    private readonly defaultRiderSearchKm;
    private readonly riderSpeedKmPerHr;
    private readonly isLoadtest;
    constructor(prisma: PrismaService, notify: NotificationService, ws: WsGateway, config: ConfigService, surge: SurgeService, geoSurge: GeoSurgeService, payments: PaymentsService, riderPayments: RiderPaymentsService, riderQuality: RiderQualityService, lifecycle: OrderLifecycleService, serviceArea: ServiceAreaService, orderAssignQueue: Queue);
    private isEscalatable;
    private toRad;
    private haversineKm;
    private logTimeline;
    private requestCustomerPayment;
    private resolveModeFromItems;
    private getAnyPharmacyId;
    createOrder(customerId: number, dto: CreateOrderDto): Promise<({
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
    uploadPrescription(customerId: number, url: string, attachOrderId?: number): Promise<{
        createdAt: Date;
        id: number;
        url: string;
        customerId: number;
        verified: boolean;
    }>;
    pharmacyRequestPrescription(pharmacyId: number, orderId: number, message?: string): Promise<{
        ok: boolean;
    }>;
    private transitionStatus;
    pharmacyRespond(pharmacyId: number, orderId: number, action: 'ACCEPTED' | 'REJECTED'): Promise<any>;
    riderRespond(riderId: number, orderId: number, action: 'ACCEPTED' | 'REJECTED', reason?: string): Promise<{
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
    } | {
        ok: boolean;
    }>;
    rateRider(customerId: number, orderId: number, dto: {
        rating: number;
        comment?: string;
    }): Promise<{
        ok: boolean;
    }>;
    riderReportIssue(riderId: number, orderId: number, dto: {
        type: 'CUSTOMER_UNREACHABLE' | 'ADDRESS_ISSUE' | 'PAYMENT_ISSUE' | 'OTHER';
        note?: string;
        lat?: number;
        lng?: number;
    }): Promise<{
        ok: boolean;
    }>;
    adminAssign(orderId: number, adminId: number, riderId: number): Promise<any>;
    updateStage(riderId: number, orderId: number, stage: OrderStatus, location?: {
        lat?: number;
        lng?: number;
    }, proof?: {
        proofUrl?: string;
        signatureUrl?: string;
        otp?: string;
    }): Promise<{
        ok: boolean;
    }>;
    findByUser(userId: number, role: string): Promise<({
        prescription: {
            createdAt: Date;
            id: number;
            url: string;
            customerId: number;
            verified: boolean;
        } | null;
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
    })[]>;
    listForPharmacy(pharmacyId: number, status?: OrderStatus): Promise<({
        customer: {
            name: string;
            email: string | null;
            phone: string | null;
            id: number;
        };
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
    })[]>;
    getForPharmacy(pharmacyId: number, orderId: number): Promise<{
        prescription: {
            createdAt: Date;
            id: number;
            url: string;
            customerId: number;
            verified: boolean;
        } | null;
        customer: {
            name: string;
            email: string | null;
            phone: string | null;
            id: number;
        };
        items: {
            name: string;
            id: number;
            medicineId: number | null;
            orderId: number;
            price: number;
            quantity: number;
        }[];
        timeline: {
            data: string | null;
            createdAt: Date;
            id: number;
            event: string;
            orderId: number;
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
    }>;
    pharmacyAccept(pharmacyId: number, orderId: number, dto?: PharmacyAcceptDto): Promise<{
        order: any;
    }>;
    pharmacyReject(pharmacyId: number, orderId: number, reason?: string): Promise<{
        ok: boolean;
    }>;
    pharmacyMarkReady(pharmacyId: number, orderId: number): Promise<{
        order: any;
    }>;
    pharmacyConfirmHandover(pharmacyId: number, orderId: number): Promise<{
        order: any;
    }>;
    pharmacyVerifyPrescription(pharmacyId: number, orderId: number): Promise<{
        ok: boolean;
        verified: boolean;
    }>;
    adminVerifyPrescription(orderId: number, adminId: number): Promise<{
        ok: boolean;
        verified: boolean;
    }>;
    getTimeline(orderId: number): Promise<{
        event: string;
        data: any;
        at: Date;
    }[]>;
    getTimelineForUser(userId: number, role: string, orderId: number): Promise<{
        event: string;
        data: any;
        at: Date;
    }[]>;
    getRiderScorePublic(rp: {
        memberId: string;
        distKm?: number;
        meta?: any;
    }, lat?: number | null, lon?: number | null): Promise<number>;
    adminForceCancel(orderId: number, reason?: string, adminId?: number): Promise<any>;
    adminForceStatus(orderId: number, status: OrderStatus, note?: string, adminId?: number): Promise<any>;
    adminCompleteDelivery(orderId: number, adminId: number, opts?: {
        note?: string;
        proofUrl?: string;
        signatureUrl?: string;
        otp?: string;
    }): Promise<{
        ok: boolean;
        order: any;
    }>;
    adminEscalateSla(orderId: number, adminId: number, opts?: {
        reason?: string;
        note?: string;
    }): Promise<{
        ok: boolean;
    }>;
    customerConfirmChanges(customerId: number, orderId: number): Promise<{
        order: any;
    }>;
    customerRejectChanges(customerId: number, orderId: number, reason?: string): Promise<{
        order: any;
    }>;
    adminUnassignRider(orderId: number, adminId?: number): Promise<any>;
    adminAddNote(orderId: number, note: string): Promise<{
        ok: boolean;
    }>;
    private getSettlementState;
    adminSettleOrder(orderId: number, adminId: number, opts?: {
        note?: string;
        force?: boolean;
    }): Promise<{
        ok: boolean;
        orderId: number;
        settled: boolean;
        already: boolean;
        settledAt: Date | null;
    } | {
        ok: boolean;
        orderId: number;
        settled: boolean;
        already?: undefined;
        settledAt?: undefined;
    }>;
    adminUnsettleOrder(orderId: number, adminId: number, opts?: {
        note?: string;
    }): Promise<{
        ok: boolean;
        orderId: number;
        settled: boolean;
        already: boolean;
    } | {
        ok: boolean;
        orderId: number;
        settled: boolean;
        already?: undefined;
    }>;
}
