import { MedicinesService } from './medicines.service';
import { Response } from 'express';
export declare class MedicinesController {
    private readonly medicinesService;
    constructor(medicinesService: MedicinesService);
    search(q: string, res: Response): Promise<Response<any, Record<string, any>>>;
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
        category: import(".prisma/client").$Enums.MedicineCategory;
        sku: string | null;
        salt: string | null;
        manufacturer: string | null;
        imageUrl: string | null;
        rxType: import(".prisma/client").$Enums.PrescriptionType;
    }>;
}
