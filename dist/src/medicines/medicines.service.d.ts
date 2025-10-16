export declare class MedicinesService {
    getMedicines(pharmacyId?: number): Promise<{
        id: number;
        name: string;
        description: string | null;
        price: import("@prisma/client/runtime/library").Decimal;
        stock: number;
        pharmacyId: number;
        createdAt: Date;
    }[]>;
    getMedicinesByPharmacy(pharmacyId: number): Promise<{
        id: number;
        name: string;
        description: string | null;
        price: import("@prisma/client/runtime/library").Decimal;
        stock: number;
        pharmacyId: number;
        createdAt: Date;
    }[]>;
    getAllMedicines(): Promise<{
        id: number;
        name: string;
        description: string | null;
        price: import("@prisma/client/runtime/library").Decimal;
        stock: number;
        pharmacyId: number;
        createdAt: Date;
    }[]>;
    createMedicine(name: string, price: number, stock: number, pharmacyId: number): Promise<{
        id: number;
        name: string;
        description: string | null;
        price: import("@prisma/client/runtime/library").Decimal;
        stock: number;
        pharmacyId: number;
        createdAt: Date;
    }>;
    updateMedicine(id: number, data: {
        name?: string;
        price?: number;
        stock?: number;
    }): Promise<{
        id: number;
        name: string;
        description: string | null;
        price: import("@prisma/client/runtime/library").Decimal;
        stock: number;
        pharmacyId: number;
        createdAt: Date;
    }>;
    deleteMedicine(id: number): Promise<{
        id: number;
        name: string;
        description: string | null;
        price: import("@prisma/client/runtime/library").Decimal;
        stock: number;
        pharmacyId: number;
        createdAt: Date;
    }>;
}
