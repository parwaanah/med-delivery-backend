import { MedicinesService } from './medicines.service';
export declare class MedicinesController {
    private readonly medicinesService;
    constructor(medicinesService: MedicinesService);
    getMedicines(pharmacyId?: string): Promise<{
        id: number;
        name: string;
        description: string | null;
        price: import("@prisma/client/runtime/library").Decimal;
        stock: number;
        pharmacyId: number;
        createdAt: Date;
    }[]>;
}
