import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../admin/audit/audit.service';
export declare class OrdersService {
    private readonly prisma;
    private readonly auditService;
    private readonly logger;
    constructor(prisma: PrismaService, auditService: AuditService);
    createOrder(userId: number, pharmacyId: number | null, items: {
        medicineId: number;
        quantity: number;
    }[], customerLat?: number, customerLng?: number): Promise<({
        pharmacy: {
            id: number;
            name: string;
            address: string;
            phone: string;
            userId: number | null;
            createdAt: Date;
            latitude: number | null;
            longitude: number | null;
            autoAccept: boolean;
        } | null;
        items: ({
            medicine: {
                id: number;
                name: string;
                description: string | null;
                price: import("@prisma/client/runtime/library").Decimal;
                stock: number;
                pharmacyId: number;
                createdAt: Date;
            };
        } & {
            id: number;
            orderId: number;
            medicineId: number;
            quantity: number;
            price: import("@prisma/client/runtime/library").Decimal;
        })[];
    } & {
        id: number;
        userId: number;
        pharmacyId: number | null;
        riderId: number | null;
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
    }) | {
        message: string;
        orderId: number;
    }>;
    private createDirectOrder;
    private createBroadcastOrder;
    pharmacyRespond(orderId: number, pharmacyId: number, decision: 'accept' | 'reject'): Promise<{
        message: string;
        order?: undefined;
    } | {
        message: string;
        order: {
            pharmacy: {
                id: number;
                name: string;
                address: string;
                phone: string;
                userId: number | null;
                createdAt: Date;
                latitude: number | null;
                longitude: number | null;
                autoAccept: boolean;
            } | null;
        } & {
            id: number;
            userId: number;
            pharmacyId: number | null;
            riderId: number | null;
            status: import(".prisma/client").$Enums.OrderStatus;
            createdAt: Date;
        };
    }>;
    riderRespond(orderId: number, riderId: number, decision: 'accept' | 'reject'): Promise<{
        message: string;
        order?: undefined;
    } | {
        message: string;
        order: {
            pharmacy: {
                id: number;
                name: string;
                address: string;
                phone: string;
                userId: number | null;
                createdAt: Date;
                latitude: number | null;
                longitude: number | null;
                autoAccept: boolean;
            } | null;
        } & {
            id: number;
            userId: number;
            pharmacyId: number | null;
            riderId: number | null;
            status: import(".prisma/client").$Enums.OrderStatus;
            createdAt: Date;
        };
    }>;
    private notifyNearbyRiders;
    private getDistance;
    private logOrderEvent;
    private sendNotification;
    getOrders(): Promise<({
        user: {
            id: number;
            name: string;
            email: string;
            password: string;
            role: import(".prisma/client").$Enums.Role;
            createdAt: Date;
            preferredPharmacyId: number | null;
            refreshToken: string | null;
        };
        pharmacy: {
            id: number;
            name: string;
            address: string;
            phone: string;
            userId: number | null;
            createdAt: Date;
            latitude: number | null;
            longitude: number | null;
            autoAccept: boolean;
        } | null;
        rider: {
            id: number;
            name: string;
            phone: string;
            vehicleNumber: string;
            isAvailable: boolean;
            userId: number;
            createdAt: Date;
            latitude: number | null;
            longitude: number | null;
        } | null;
        items: ({
            medicine: {
                id: number;
                name: string;
                description: string | null;
                price: import("@prisma/client/runtime/library").Decimal;
                stock: number;
                pharmacyId: number;
                createdAt: Date;
            };
        } & {
            id: number;
            orderId: number;
            medicineId: number;
            quantity: number;
            price: import("@prisma/client/runtime/library").Decimal;
        })[];
    } & {
        id: number;
        userId: number;
        pharmacyId: number | null;
        riderId: number | null;
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
    })[]>;
    assignRider(orderId: number, riderId: number): Promise<{
        rider: {
            id: number;
            name: string;
            phone: string;
            vehicleNumber: string;
            isAvailable: boolean;
            userId: number;
            createdAt: Date;
            latitude: number | null;
            longitude: number | null;
        } | null;
    } & {
        id: number;
        userId: number;
        pharmacyId: number | null;
        riderId: number | null;
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
    }>;
    updateOrderStatus(orderId: number, status: string): Promise<{
        pharmacy: {
            id: number;
            name: string;
            address: string;
            phone: string;
            userId: number | null;
            createdAt: Date;
            latitude: number | null;
            longitude: number | null;
            autoAccept: boolean;
        } | null;
    } & {
        id: number;
        userId: number;
        pharmacyId: number | null;
        riderId: number | null;
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
    }>;
    getOrdersByRider(riderId: number): Promise<({
        user: {
            id: number;
            name: string;
            email: string;
            password: string;
            role: import(".prisma/client").$Enums.Role;
            createdAt: Date;
            preferredPharmacyId: number | null;
            refreshToken: string | null;
        };
        pharmacy: {
            id: number;
            name: string;
            address: string;
            phone: string;
            userId: number | null;
            createdAt: Date;
            latitude: number | null;
            longitude: number | null;
            autoAccept: boolean;
        } | null;
        items: ({
            medicine: {
                id: number;
                name: string;
                description: string | null;
                price: import("@prisma/client/runtime/library").Decimal;
                stock: number;
                pharmacyId: number;
                createdAt: Date;
            };
        } & {
            id: number;
            orderId: number;
            medicineId: number;
            quantity: number;
            price: import("@prisma/client/runtime/library").Decimal;
        })[];
    } & {
        id: number;
        userId: number;
        pharmacyId: number | null;
        riderId: number | null;
        status: import(".prisma/client").$Enums.OrderStatus;
        createdAt: Date;
    })[]>;
}
