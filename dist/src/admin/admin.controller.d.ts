import { AdminService } from './admin.service';
import { CreatePharmacyDto } from './dto/create-pharmacy.dto';
import { AddMedicineDto } from './dto/add-medicine.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    createPharmacy(dto: CreatePharmacyDto): Promise<{
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
    addMedicine(dto: AddMedicineDto): Promise<{
        id: number;
        name: string;
        description: string | null;
        price: import("@prisma/client/runtime/library").Decimal;
        stock: number;
        pharmacyId: number;
        createdAt: Date;
    }>;
    updateStock(id: string, dto: UpdateStockDto): Promise<{
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
    updateOrderStatus(id: string, dto: UpdateStatusDto): Promise<{
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
    }>;
}
