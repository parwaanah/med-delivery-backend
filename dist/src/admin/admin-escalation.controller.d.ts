import { PrismaService } from '../utils/prisma.service';
import { EscalationService } from './escalation.service';
import { OrdersService } from '../orders/orders.service';
export declare class AdminEscalationController {
    private prisma;
    private esc;
    private orders;
    constructor(prisma: PrismaService, esc: EscalationService, orders: OrdersService);
    getEscalated(): Promise<{
        total: number;
        items: {
            notification: {
                id: number;
                status: string;
                createdAt: Date;
                senderId: number | null;
                receiverId: number;
                type: string;
                message: string;
                meta: import("@prisma/client/runtime/library").JsonValue | null;
            };
            order: ({
                customer: {
                    email: string;
                };
                pharmacy: {
                    email: string;
                    latitude: number | null;
                    longitude: number | null;
                };
                rider: {
                    email: string;
                } | null;
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
            }) | null;
        }[];
    }>;
    getCandidates(id: string): Promise<{
        total: number;
        candidates: {
            user: {
                id: number;
                status: string;
                name: string;
                email: string;
                latitude: number | null;
                longitude: number | null;
            } | null;
            riderId: number | null;
            score: number;
            meta: any;
            distKm: number | null;
        }[];
    }>;
    assign(id: string, riderId: string): Promise<{
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
