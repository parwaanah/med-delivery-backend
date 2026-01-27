import { MedicinesService } from './medicines.service';
import { Response } from 'express';
export declare class MedicinesController {
    private readonly medicinesService;
    constructor(medicinesService: MedicinesService);
    search(q: string, queryAlt: string, res: Response): Promise<Response<any, Record<string, any>>>;
    getById(id: string): Promise<{
        stock: number;
        price: number;
        mrp: number;
        discount: number;
        pharmacy: string;
        pharmacyId: number;
        name: string;
        createdAt: Date;
        id: number;
        sku: string | null;
        salt: string | null;
        manufacturer: string | null;
        imageUrl: string | null;
        category: import(".prisma/client").$Enums.MedicineCategory;
        rxType: import(".prisma/client").$Enums.PrescriptionType;
    }>;
}
