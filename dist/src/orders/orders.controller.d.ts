import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { RespondOfferDto } from './dto/respond-offer.dto';
export declare class OrdersController {
    private readonly ordersService;
    constructor(ordersService: OrdersService);
    create(req: any, dto: CreateOrderDto): Promise<({
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
    findAll(req: any): any;
    pharmacyRespond(req: any, orderId: string, dto: RespondOfferDto): any;
    riderRespond(req: any, orderId: string, dto: RespondOfferDto): any;
    riderStage(req: any, orderId: string, body: {
        stage: 'REACHED_PHARMACY' | 'PICKED_UP' | 'DELIVERED';
        location?: any;
    }): any;
    adminAssign(req: any, orderId: string, riderId: string): any;
}
