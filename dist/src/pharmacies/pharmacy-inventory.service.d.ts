import { PrismaService } from '../utils/prisma.service';
import { SurgeService } from '../surge/surge.service';
import { NotificationService } from '../utils/notification.service';
export declare class PharmacyInventoryService {
    private prisma;
    private surge;
    private notify;
    constructor(prisma: PrismaService, surge: SurgeService, notify: NotificationService);
    listInventory(pharmacyId: number): Promise<({
        medicine: {
            name: string;
            createdAt: Date;
            id: number;
            category: import(".prisma/client").$Enums.MedicineCategory;
            sku: string | null;
            rxType: import(".prisma/client").$Enums.PrescriptionType;
        };
    } & {
        createdAt: Date;
        id: number;
        medicineId: number;
        pharmacyId: number;
        stock: number;
        discount: number;
        mrp: import("@prisma/client/runtime/library").Decimal;
        sellingPrice: import("@prisma/client/runtime/library").Decimal;
    })[]>;
    add(pharmacyId: number, dto: any): Promise<{
        createdAt: Date;
        id: number;
        medicineId: number;
        pharmacyId: number;
        stock: number;
        discount: number;
        mrp: import("@prisma/client/runtime/library").Decimal;
        sellingPrice: import("@prisma/client/runtime/library").Decimal;
    }>;
    update(inventoryId: number, dto: any): Promise<{
        createdAt: Date;
        id: number;
        medicineId: number;
        pharmacyId: number;
        stock: number;
        discount: number;
        mrp: import("@prisma/client/runtime/library").Decimal;
        sellingPrice: import("@prisma/client/runtime/library").Decimal;
    }>;
    remove(inventoryId: number): Promise<{
        ok: boolean;
        deletedId: number;
    }>;
    getMedicinePrice(pharmacyId: number, medicineId: number): Promise<{
        price: number;
        stock: number;
    }>;
    calculatePrice(pharmacyId: number, medicineId: number): Promise<{
        price: number;
        basePrice: number;
        multiplier: number;
    }>;
    updateStock(pharmacyId: number, medicineId: number, delta: number): Promise<{
        createdAt: Date;
        id: number;
        medicineId: number;
        pharmacyId: number;
        stock: number;
        discount: number;
        mrp: import("@prisma/client/runtime/library").Decimal;
        sellingPrice: import("@prisma/client/runtime/library").Decimal;
    }>;
}
