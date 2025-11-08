import { PrismaService } from '../utils/prisma.service';
import { SurgeService } from '../surge/surge.service';
import { NotificationService } from '../utils/notification.service';
export declare class PharmacyInventoryService {
    private prisma;
    private surge;
    private notify;
    constructor(prisma: PrismaService, surge: SurgeService, notify: NotificationService);
    listInventory(pharmacyId: number): Promise<({
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
    getMedicinePrice(pharmacyId: number, medicineId: number): Promise<{
        price: number;
        stock: number;
    }>;
    calculatePrice(pharmacyId: number, medicineId: number): Promise<{
        price: number;
        basePrice: number;
        multiplier: number;
    }>;
    updateStock(pharmacyId: number, medicineId: number, delta: number): Promise<{
        createdAt: Date;
        id: number;
        pharmacyId: number;
        medicineId: number;
        price: number;
        stock: number;
    }>;
}
