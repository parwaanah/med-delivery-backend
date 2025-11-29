import { PharmaciesService } from './pharmacies.service';
import { CreatePharmacyDto, UpdatePharmacyDto } from './dto/pharmacy.dto';
export declare class PharmaciesController {
    private readonly pharmaciesService;
    constructor(pharmaciesService: PharmaciesService);
    findAll(): Promise<{
        name: string;
        email: string;
        createdAt: Date;
        id: number;
        latitude: number | null;
        longitude: number | null;
    }[]>;
    findOne(id: string): Promise<{
        name: string;
        email: string;
        createdAt: Date;
        id: number;
        latitude: number | null;
        longitude: number | null;
    }>;
    create(dto: CreatePharmacyDto): Promise<{
        name: string;
        email: string;
        role: import(".prisma/client").$Enums.UserRole;
        id: number;
    }>;
    update(id: string, dto: UpdatePharmacyDto): Promise<{
        name: string;
        email: string;
        role: import(".prisma/client").$Enums.UserRole;
        id: number;
    }>;
    remove(id: string): Promise<{
        message: string;
    }>;
    updateLocation(id: string, lat: number, lon: number): Promise<{
        id: number;
        latitude: number | null;
        longitude: number | null;
        ok: boolean;
    }>;
}
