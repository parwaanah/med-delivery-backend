import { RidersService } from './riders.service';
export declare class RidersController {
    private readonly ridersService;
    constructor(ridersService: RidersService);
    createRider(body: {
        name: string;
        phone: string;
        vehicleNumber: string;
        password?: string;
    }): Promise<{
        id: number;
        name: string;
        phone: string;
        vehicleNumber: string;
        isAvailable: boolean;
        userId: number;
        createdAt: Date;
        latitude: number | null;
        longitude: number | null;
    }>;
    getAllRiders(): Promise<({
        user: {
            id: number;
            name: string;
            email: string;
            password: string;
            role: import(".prisma/client").$Enums.Role;
            createdAt: Date;
            preferredPharmacyId: number | null;
            refreshToken: string | null;
        };
    } & {
        id: number;
        name: string;
        phone: string;
        vehicleNumber: string;
        isAvailable: boolean;
        userId: number;
        createdAt: Date;
        latitude: number | null;
        longitude: number | null;
    })[]>;
    updateRider(id: string, data: any): Promise<{
        id: number;
        name: string;
        phone: string;
        vehicleNumber: string;
        isAvailable: boolean;
        userId: number;
        createdAt: Date;
        latitude: number | null;
        longitude: number | null;
    }>;
    deleteRider(id: string): Promise<{
        id: number;
        name: string;
        phone: string;
        vehicleNumber: string;
        isAvailable: boolean;
        userId: number;
        createdAt: Date;
        latitude: number | null;
        longitude: number | null;
    }>;
}
