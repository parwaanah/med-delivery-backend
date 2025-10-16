import { $Enums } from '@prisma/client';
export declare class AdminService {
    createPharmacy(name: string, address: string, phone: string): Promise<{
        id: number;
        name: string;
        address: string;
        phone: string;
        userId: number | null;
        createdAt: Date;
        latitude: number | null;
        longitude: number | null;
        autoAccept: boolean;
    }>;
    addMedicine(pharmacyId: number, name: string, price: number, stock: number): Promise<{
        id: number;
        name: string;
        description: string | null;
        price: import("@prisma/client/runtime/library").Decimal;
        stock: number;
        pharmacyId: number;
        createdAt: Date;
    }>;
    updateMedicineStock(medicineId: number, stock: number): Promise<{
        id: number;
        name: string;
        description: string | null;
        price: import("@prisma/client/runtime/library").Decimal;
        stock: number;
        pharmacyId: number;
        createdAt: Date;
    }>;
    getAllOrders(): Promise<({
        user: {
            id: number;
            name: string;
            email: string;
            password: string;
            role: $Enums.Role;
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
        status: $Enums.OrderStatus;
        createdAt: Date;
    })[]>;
    updateOrderStatus(orderId: number, status: string): Promise<{
        user: {
            id: number;
            name: string;
            email: string;
            password: string;
            role: $Enums.Role;
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
        status: $Enums.OrderStatus;
        createdAt: Date;
    }>;
}
