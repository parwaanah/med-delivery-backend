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
        sku: string | null;
        salt: string | null;
        manufacturer: string | null;
        imageUrl: string | null;
        category: import(".prisma/client").$Enums.MedicineCategory;
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
        sku: string | null;
        salt: string | null;
        manufacturer: string | null;
        imageUrl: string | null;
        category: import(".prisma/client").$Enums.MedicineCategory;
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
        sku: string | null;
        salt: string | null;
        manufacturer: string | null;
        imageUrl: string | null;
        category: import(".prisma/client").$Enums.MedicineCategory;
        rxType: import(".prisma/client").$Enums.PrescriptionType;
    } | null>;
}
