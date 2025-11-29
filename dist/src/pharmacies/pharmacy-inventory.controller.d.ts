import { PharmacyInventoryService } from './pharmacy-inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
export declare class PharmaciesInventoryController {
    private readonly svc;
    constructor(svc: PharmacyInventoryService);
    addInventory(req: any, id: string, dto: CreateInventoryDto): Promise<{
        createdAt: Date;
        id: number;
        medicineId: number;
        pharmacyId: number;
        stock: number;
        discount: number;
        mrp: import("@prisma/client/runtime/library").Decimal;
        sellingPrice: import("@prisma/client/runtime/library").Decimal;
    }>;
    updateInventory(req: any, id: string, invId: string, dto: UpdateInventoryDto): Promise<{
        createdAt: Date;
        id: number;
        medicineId: number;
        pharmacyId: number;
        stock: number;
        discount: number;
        mrp: import("@prisma/client/runtime/library").Decimal;
        sellingPrice: import("@prisma/client/runtime/library").Decimal;
    }>;
    removeInventory(req: any, id: string, invId: string): Promise<{
        ok: boolean;
        deletedId: number;
    }>;
    listInventory(id: string): Promise<({
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
}
