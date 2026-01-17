import { PrismaService } from '../utils/prisma.service';
export declare class MedicinesService {
    private prisma;
    constructor(prisma: PrismaService);
    searchMedicines(query: string): Promise<({
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
    } | null)[]>;
    getFeaturedMedicines(): Promise<({
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
    } | null)[]>;
    getMedicineById(id: number): Promise<{
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
    } | null>;
}
