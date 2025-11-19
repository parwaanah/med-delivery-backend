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
                message: string;
                type: string;
                meta: import("@prisma/client/runtime/library").JsonValue | null;
                status: string;
                createdAt: Date;
                id: number;
                senderId: number | null;
                receiverId: number;
            };
            order: ({
                items: {
                    name: string;
                    id: number;
                    medicineId: number | null;
                    price: number;
                    quantity: number;
                    orderId: number;
                }[];
                pharmacy: {
                    email: string;
                    latitude: number | null;
                    longitude: number | null;
                };
                rider: {
                    email: string;
                } | null;
                customer: {
                    email: string;
                };
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
            }) | null;
        }[];
    }>;
    getCandidates(id: string): Promise<{
        total: number;
        candidates: {
            user: {
                name: string;
                email: string;
                status: string;
                id: number;
                latitude: number | null;
                longitude: number | null;
            } | null;
            riderId: number | null;
            score: number;
            distKm: number | null;
            meta: any;
        }[];
    }>;
    assign(id: string, riderId: string): Promise<{
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
