import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { RespondOfferDto } from './dto/respond-offer.dto';
export declare class OrdersController {
    private readonly ordersService;
    constructor(ordersService: OrdersService);
    create(req: any, dto: CreateOrderDto): Promise<({
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
        riderId: number | null;
        totalPrice: number;
        customerId: number;
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
            riderId: number | null;
            totalPrice: number;
            customerId: number;
        };
        candidates: number[];
        scores: {
            pharmacyId: number;
            score: number;
        }[];
    }>;
    findAll(req: any): Promise<({
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
        riderId: number | null;
        totalPrice: number;
        customerId: number;
    })[]>;
    pharmacyRespond(req: any, orderId: string, dto: RespondOfferDto): Promise<{
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
        id: number;
        updatedAt: Date;
        deletedAt: Date | null;
        pharmacyId: number;
        riderId: number | null;
        totalPrice: number;
        customerId: number;
    } | {
        ok: boolean;
    }>;
    riderRespond(req: any, orderId: string, dto: RespondOfferDto): Promise<{
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
        id: number;
        updatedAt: Date;
        deletedAt: Date | null;
        pharmacyId: number;
        riderId: number | null;
        totalPrice: number;
        customerId: number;
    } | {
        ok: boolean;
    }>;
    riderStage(req: any, orderId: string, body: {
        stage: 'REACHED_PHARMACY' | 'PICKED_UP' | 'DELIVERED';
        location?: any;
    }): Promise<{
        ok: boolean;
    }>;
    adminAssign(req: any, orderId: string, riderId: string): Promise<{
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
        id: number;
        updatedAt: Date;
        deletedAt: Date | null;
        pharmacyId: number;
        riderId: number | null;
        totalPrice: number;
        customerId: number;
    }>;
}
