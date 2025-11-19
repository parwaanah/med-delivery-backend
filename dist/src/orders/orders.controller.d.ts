import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { RespondOfferDto } from './dto/respond-offer.dto';
export declare class OrdersController {
    private readonly ordersService;
    constructor(ordersService: OrdersService);
    create(req: any, dto: CreateOrderDto): Promise<({
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
    findAll(req: any): Promise<({
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
    pharmacyRespond(req: any, orderId: string, dto: RespondOfferDto): Promise<{
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
    riderRespond(req: any, orderId: string, dto: RespondOfferDto): Promise<{
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
    riderStage(req: any, orderId: string, body: {
        stage: 'REACHED_PHARMACY' | 'PICKED_UP' | 'DELIVERED';
        location?: any;
    }): Promise<{
        ok: boolean;
    }>;
    adminAssign(req: any, orderId: string, riderId: string): Promise<{
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
}
