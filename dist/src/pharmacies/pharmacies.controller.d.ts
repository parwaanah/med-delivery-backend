import { PharmaciesService } from './pharmacies.service';
export declare class PharmaciesController {
    private readonly pharmaciesService;
    constructor(pharmaciesService: PharmaciesService);
    findAll(): Promise<{
        id: number;
        name: string;
        address: string;
        phone: string;
        userId: number | null;
        createdAt: Date;
        latitude: number | null;
        longitude: number | null;
        autoAccept: boolean;
    }[]>;
    findOne(id: string): Promise<{
        id: number;
        name: string;
        address: string;
        phone: string;
        userId: number | null;
        createdAt: Date;
        latitude: number | null;
        longitude: number | null;
        autoAccept: boolean;
    } | null>;
    create(req: any, body: {
        name: string;
        address: string;
        phone: string;
    }): Promise<{
        id: number;
        name: string;
        address: string;
        phone: string;
        userId: number | null;
        createdAt: Date;
        latitude: number | null;
        longitude: number | null;
        autoAccept: boolean;
    }>;
    addMedicine(req: any, id: string, body: {
        name: string;
        description?: string;
        price: number;
        stock: number;
    }): Promise<{
        id: number;
        name: string;
        description: string | null;
        price: import("@prisma/client/runtime/library").Decimal;
        stock: number;
        pharmacyId: number;
        createdAt: Date;
    }>;
}
