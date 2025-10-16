import { Pharmacy, Medicine } from '@prisma/client';
export declare class PharmaciesService {
    findAll(): Promise<Pharmacy[]>;
    findOne(id: number): Promise<Pharmacy | null>;
    create(data: {
        name: string;
        address: string;
        phone: string;
    }): Promise<Pharmacy>;
    addMedicine(pharmacyId: number, medicineData: {
        name: string;
        description?: string;
        price: number;
        stock: number;
    }): Promise<Medicine>;
}
