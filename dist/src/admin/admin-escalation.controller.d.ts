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
                status: string;
                createdAt: Date;
                id: number;
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
                paymentMode: import(".prisma/client").$Enums.PaymentMode;
                requiresPrescription: boolean;
                id: number;
                customerId: number;
                pharmacyId: number;
                riderId: number | null;
                prescriptionId: number | null;
            }) | null;
        }[];
    }>;
    getCandidates(id: string): Promise<{
        total: number;
        candidates: {
            user: {
                status: string;
                id: number;
                name: string;
                email: string;
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
        totalPrice: number;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        paymentMode: import(".prisma/client").$Enums.PaymentMode;
        requiresPrescription: boolean;
        id: number;
        customerId: number;
        pharmacyId: number;
        riderId: number | null;
        prescriptionId: number | null;
    }>;
}
