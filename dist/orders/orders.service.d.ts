import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Queue } from 'bullmq';
import { WsGateway } from '../ws/ws.gateway';
import { ConfigService } from '@nestjs/config';
import { SurgeService } from '../surge/surge.service';
export declare class OrdersService {
    private prisma;
    private notify;
    private ws;
    private config;
    private surge;
    private orderAssignQueue;
    private readonly logger;
    constructor(prisma: PrismaService, notify: NotificationService, ws: WsGateway, config: ConfigService, surge: SurgeService, orderAssignQueue: Queue);
    createOrder(customerId: number, dto: CreateOrderDto): Promise<({
        items: {
            name: string;
            id: number;
            medicineId: number | null;
            price: number;
            quantity: number;
            orderId: number;
        }[];
    } & {
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
        id: number;
        updatedAt: Date;
        deletedAt: Date | null;
        pharmacyId: number;
        totalPrice: number;
        customerId: number;
        riderId: number | null;
    }) | {
        order: {
            items: {
                name: string;
                id: number;
                medicineId: number | null;
                price: number;
                quantity: number;
                orderId: number;
            }[];
        } & {
            status: import(".prisma/client").$Enums.OrderStatus;
            createdAt: Date;
            id: number;
            updatedAt: Date;
            deletedAt: Date | null;
            pharmacyId: number;
            totalPrice: number;
            customerId: number;
            riderId: number | null;
        };
        candidates: number[];
    }>;
    pharmacyRespond(pharmacyId: number, orderId: number, action: 'ACCEPTED' | 'REJECTED'): Promise<{
        ok: boolean;
        assigned?: undefined;
        offeredTo?: undefined;
    } | {
        ok: boolean;
        assigned: boolean;
        offeredTo?: undefined;
    } | {
        ok: boolean;
        offeredTo: number[];
        assigned?: undefined;
    }>;
    riderRespond(riderId: number, orderId: number, action: 'ACCEPTED' | 'REJECTED'): Promise<{
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
        id: number;
        updatedAt: Date;
        deletedAt: Date | null;
        pharmacyId: number;
        totalPrice: number;
        customerId: number;
        riderId: number | null;
    } | {
        ok: boolean;
    }>;
    updateStage(riderId: number, orderId: number, stage: 'REACHED_PHARMACY' | 'PICKED_UP' | 'DELIVERED', location?: {
        lat: number;
        lng: number;
    }): Promise<{
        ok: boolean;
    }>;
    adminAssign(orderId: number, adminId: number, riderId: number): Promise<{
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
        id: number;
        updatedAt: Date;
        deletedAt: Date | null;
        pharmacyId: number;
        totalPrice: number;
        customerId: number;
        riderId: number | null;
    }>;
    findByUser(userId: number, role: string): Promise<({
        items: {
            name: string;
            id: number;
            medicineId: number | null;
            price: number;
            quantity: number;
            orderId: number;
        }[];
    } & {
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
        id: number;
        updatedAt: Date;
        deletedAt: Date | null;
        pharmacyId: number;
        totalPrice: number;
        customerId: number;
        riderId: number | null;
    })[]>;
}
