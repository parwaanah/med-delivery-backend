import { PharmaciesService } from './pharmacies.service';
import { CreatePharmacyDto, UpdatePharmacyDto } from './dto/pharmacy.dto';
export declare class PharmaciesController {
    private readonly pharmaciesService;
    constructor(pharmaciesService: PharmaciesService);
    findAll(): Promise<{
        name: string;
        email: string;
        id: number;
        createdAt: Date;
    }[]>;
    findOne(id: string): Promise<{
        name: string;
        email: string;
        id: number;
        createdAt: Date;
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
}
