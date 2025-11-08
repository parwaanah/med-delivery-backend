import { PharmacyInventoryService } from './pharmacy-inventory.service';
export declare class PharmacyInventoryController {
    private readonly svc;
    constructor(svc: PharmacyInventoryService);
    getPrice(pharmacyId: string, medicineId: string, _demand?: string): Promise<{
        price: number;
        basePrice: number;
        multiplier: number;
    }>;
    getInventory(pharmacyId: string): Promise<({
        medicine: {
            name: string;
            createdAt: Date;
            id: number;
            sku: string | null;
        };
    } & {
        createdAt: Date;
        id: number;
        pharmacyId: number;
        medicineId: number;
        price: number;
        stock: number;
    })[]>;
}
