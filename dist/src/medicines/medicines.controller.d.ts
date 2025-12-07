import { MedicinesService } from './medicines.service';
export declare class MedicinesController {
    private readonly medicinesService;
    constructor(medicinesService: MedicinesService);
    search(q: string): Promise<{
        stock: number;
        price: number;
        mrp: number;
        discount: number;
        pharmacy: string | null;
        pharmacyId: number | null;
        name: string;
        createdAt: Date;
        id: number;
        category: import(".prisma/client").$Enums.MedicineCategory;
        sku: string | null;
        salt: string | null;
        manufacturer: string | null;
        imageUrl: string | null;
        rxType: import(".prisma/client").$Enums.PrescriptionType;
    }[]>;
}
