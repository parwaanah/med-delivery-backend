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
        customerId: number;
        riderId: number | null;
        totalPrice: number;
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
            customerId: number;
            riderId: number | null;
            totalPrice: number;
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
        customerId: number;
        riderId: number | null;
        totalPrice: number;
    })[]>;
    pharmacyRespond(req: any, orderId: string, dto: RespondOfferDto): Promise<{
        ok: boolean;
        order?: undefined;
        payment?: undefined;
        paymentError?: undefined;
    } | {
        order: {
            status: import(".prisma/client").$Enums.OrderStatus;
            createdAt: Date;
            id: number;
            updatedAt: Date;
            deletedAt: Date | null;
            pharmacyId: number;
            customerId: number;
            riderId: number | null;
            totalPrice: number;
        };
        payment: {
            rzpOrder: any;
            transaction: {
                status: string;
                createdAt: Date;
                id: string;
                method: string | null;
                amount: import("@prisma/client/runtime/library").Decimal;
                currency: string;
                orderId: number | null;
                provider: string;
                providerOrder: string | null;
                providerPayment: string | null;
                rawData: import("@prisma/client/runtime/library").JsonValue | null;
            };
        };
        ok?: undefined;
        paymentError?: undefined;
    } | {
        order: {
            status: import(".prisma/client").$Enums.OrderStatus;
            createdAt: Date;
            id: number;
            updatedAt: Date;
            deletedAt: Date | null;
            pharmacyId: number;
            customerId: number;
            riderId: number | null;
            totalPrice: number;
        };
        paymentError: any;
        ok?: undefined;
        payment?: undefined;
    }>;
    riderRespond(req: any, orderId: string, dto: RespondOfferDto): Promise<{
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
        id: number;
        updatedAt: Date;
        deletedAt: Date | null;
        pharmacyId: number;
        customerId: number;
        riderId: number | null;
        totalPrice: number;
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
        customerId: number;
        riderId: number | null;
        totalPrice: number;
    }>;
}
