import { PrismaService } from '../utils/prisma.service';
import { WsGateway } from '../ws/ws.gateway';
import { OrdersService } from '../orders/orders.service';
import { AuditService } from '../utils/audit.service';
import { NotificationService } from '../utils/notification.service';
export declare class AdminPharmaciesController {
    private readonly prisma;
    private readonly ws;
    private readonly orders;
    private readonly audit;
    private readonly notify;
    constructor(prisma: PrismaService, ws: WsGateway, orders: OrdersService, audit: AuditService, notify: NotificationService);
    inventory(id: string): Promise<{
        pharmacyId: number;
        items: {
            createdAt: Date;
            id: number;
            pharmacyId: number;
            medicineId: number;
            stock: number;
            discount: number;
            mrp: import("@prisma/client/runtime/library").Decimal;
            sellingPrice: import("@prisma/client/runtime/library").Decimal;
        }[];
    }>;
    freeze(id: string, body: {
        reason?: string;
    }, req: any): Promise<{
        ok: boolean;
        status: string;
    }>;
    unfreeze(id: string, body: {
        reason?: string;
    }, req: any): Promise<{
        ok: boolean;
        status: string;
    }>;
    unassignOrders(id: string, req: any): Promise<{
        ok: boolean;
        count: number;
    }>;
}
