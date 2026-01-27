import { PharmacyInventoryService } from './pharmacy-inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { PrismaService } from '../utils/prisma.service';
export declare class PharmaciesInventoryController {
    private readonly svc;
    constructor(svc: PharmacyInventoryService);
    addInventory(req: any, id: string, dto: CreateInventoryDto): Promise<{
        createdAt: Date;
        id: number;
        pharmacyId: number;
        medicineId: number;
        stock: number;
        discount: number;
        mrp: import("@prisma/client/runtime/library").Decimal;
        sellingPrice: import("@prisma/client/runtime/library").Decimal;
    }>;
    updateInventory(req: any, id: string, invId: string, dto: UpdateInventoryDto): Promise<{
        createdAt: Date;
        id: number;
        pharmacyId: number;
        medicineId: number;
        stock: number;
        discount: number;
        mrp: import("@prisma/client/runtime/library").Decimal;
        sellingPrice: import("@prisma/client/runtime/library").Decimal;
    }>;
    removeInventory(req: any, id: string, invId: string): Promise<{
        ok: boolean;
        deletedId: number;
        softDeleted: boolean;
    }>;
    listInventory(id: string): Promise<{
        createdAt: Date;
        id: number;
        pharmacyId: number;
        medicineId: number;
        stock: number;
        discount: number;
        mrp: import("@prisma/client/runtime/library").Decimal;
        sellingPrice: import("@prisma/client/runtime/library").Decimal;
    }[]>;
}
export declare class PharmacyInventoryController {
    private readonly svc;
    private readonly prisma;
    constructor(svc: PharmacyInventoryService, prisma: PrismaService);
    list(req: any): Promise<{
        createdAt: Date;
        id: number;
        pharmacyId: number;
        medicineId: number;
        stock: number;
        discount: number;
        mrp: import("@prisma/client/runtime/library").Decimal;
        sellingPrice: import("@prisma/client/runtime/library").Decimal;
    }[]>;
    add(req: any, dto: CreateInventoryDto): Promise<({
        medicine: {
            name: string;
            id: number;
            category: import(".prisma/client").$Enums.MedicineCategory;
            rxType: import(".prisma/client").$Enums.PrescriptionType;
        };
    } & {
        createdAt: Date;
        id: number;
        pharmacyId: number;
        medicineId: number;
        stock: number;
        discount: number;
        mrp: import("@prisma/client/runtime/library").Decimal;
        sellingPrice: import("@prisma/client/runtime/library").Decimal;
    }) | null>;
    update(req: any, id: string, dto: UpdateInventoryDto): Promise<({
        medicine: {
            name: string;
            id: number;
            category: import(".prisma/client").$Enums.MedicineCategory;
            rxType: import(".prisma/client").$Enums.PrescriptionType;
        };
    } & {
        createdAt: Date;
        id: number;
        pharmacyId: number;
        medicineId: number;
        stock: number;
        discount: number;
        mrp: import("@prisma/client/runtime/library").Decimal;
        sellingPrice: import("@prisma/client/runtime/library").Decimal;
    }) | null>;
    remove(req: any, id: string): Promise<{
        ok: boolean;
        deletedId: number;
        softDeleted: boolean;
    }>;
}
