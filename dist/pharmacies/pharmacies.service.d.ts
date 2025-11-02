import { PrismaService } from '../utils/prisma.service';
import { CreatePharmacyDto, UpdatePharmacyDto } from './dto/pharmacy.dto';
export declare class PharmaciesService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        name: string;
        email: string;
        id: number;
        createdAt: Date;
    }[]>;
    findOne(id: number): Promise<{
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
    update(id: number, dto: UpdatePharmacyDto): Promise<{
        name: string;
        email: string;
        role: import(".prisma/client").$Enums.UserRole;
        id: number;
    }>;
    remove(id: number): Promise<{
        message: string;
    }>;
}
