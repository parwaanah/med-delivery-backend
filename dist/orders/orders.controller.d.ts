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
        totalPrice: number;
        customerId: number;
        riderId: number | null;
    })[]>;
    pharmacyRespond(req: any, orderId: string, dto: RespondOfferDto): Promise<{
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
    riderRespond(req: any, orderId: string, dto: RespondOfferDto): Promise<{
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
        totalPrice: number;
        customerId: number;
        riderId: number | null;
    }>;
}
