import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Queue } from 'bullmq';
import { WsGateway } from '../ws/ws.gateway';
import { ConfigService } from '@nestjs/config';
import { SurgeService } from '../surge/surge.service';
import { GeoSurgeService } from '../geosurge/geo-surge.service';
export declare class OrdersService {
    private prisma;
    private notify;
    private ws;
    private config;
    private surge;
    private geoSurge;
    private orderAssignQueue;
    private readonly logger;
    private readonly defaultRiderSearchKm;
    private readonly riderSpeedKmPerHr;
    constructor(prisma: PrismaService, notify: NotificationService, ws: WsGateway, config: ConfigService, surge: SurgeService, geoSurge: GeoSurgeService, orderAssignQueue: Queue);
    private haversineKm;
    private estimateEtaMinutes;
    private computePharmacyScore;
    private computeRiderScore;
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
        id: number;
        customerId: number;
        pharmacyId: number;
        riderId: number | null;
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
            id: number;
            customerId: number;
            pharmacyId: number;
            riderId: number | null;
        };
        candidates: number[];
        scores: {
            pharmacyId: number;
            score: number;
        }[];
    }>;
}
