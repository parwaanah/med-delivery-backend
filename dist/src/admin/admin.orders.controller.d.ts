import { PrismaService } from '../utils/prisma.service';
export declare class AdminOrdersController {
    private prisma;
    constructor(prisma: PrismaService);
    getAllOrders(): Promise<{
        total: number;
        orders: ({
            pharmacy: {
                email: string;
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
            totalPrice: number;
            customerId: number;
            riderId: number | null;
        })[];
    }>;
}
