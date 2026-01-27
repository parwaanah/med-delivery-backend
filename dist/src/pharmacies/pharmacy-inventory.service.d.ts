import { Prisma } from '@prisma/client';
import { PrismaService } from '../utils/prisma.service';
import { SurgeService } from '../surge/surge.service';
import { NotificationService } from '../utils/notification.service';
export declare class PharmacyInventoryService {
    private prisma;
    private surge;
    private notify;
    constructor(prisma: PrismaService, surge: SurgeService, notify: NotificationService);
    listInventory(pharmacyId: number): Promise<{
        createdAt: Date;
        id: number;
        pharmacyId: number;
        medicineId: number;
        stock: number;
        discount: number;
        mrp: Prisma.Decimal;
        sellingPrice: Prisma.Decimal;
    }[]>;
    add(pharmacyId: number, dto: any): Promise<{
        createdAt: Date;
        id: number;
        pharmacyId: number;
        medicineId: number;
        stock: number;
        discount: number;
        mrp: Prisma.Decimal;
        sellingPrice: Prisma.Decimal;
    }>;
    update(inventoryId: number, dto: any): Promise<{
        createdAt: Date;
        id: number;
        pharmacyId: number;
        medicineId: number;
        stock: number;
        discount: number;
        mrp: Prisma.Decimal;
        sellingPrice: Prisma.Decimal;
    }>;
    remove(inventoryId: number): Promise<{
        ok: boolean;
        deletedId: number;
        softDeleted: boolean;
    }>;
    getMedicinePrice(pharmacyId: number, medicineId: number): Promise<{
        price: number;
        stock: any;
    }>;
    calculatePrice(pharmacyId: number, medicineId: number): Promise<{
        price: number;
        basePrice: number;
        multiplier: number;
    }>;
    updateStock(pharmacyId: number, medicineId: number, delta: number): Promise<{
        createdAt: Date;
        id: number;
        pharmacyId: number;
        medicineId: number;
        stock: number;
        discount: number;
        mrp: Prisma.Decimal;
        sellingPrice: Prisma.Decimal;
    }>;
}
