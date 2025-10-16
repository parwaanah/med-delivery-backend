export declare class RidersService {
    createRider(name: string, phone: string, vehicleNumber: string, password?: string): Promise<{
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
    updateRider(id: number, data: {
        name?: string;
        phone?: string;
        isAvailable?: boolean;
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
    deleteRider(id: number): Promise<{
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
