import { PrismaService } from '../utils/prisma.service';
import { CreatePharmacyDto, UpdatePharmacyDto } from './dto/pharmacy.dto';
import { GeoSurgeService } from '../geosurge/geo-surge.service';
export declare class PharmaciesService {
    private prisma;
    private geoSurge;
    constructor(prisma: PrismaService, geoSurge: GeoSurgeService);
    findAll(): Promise<{
        name: string;
        email: string | null;
        createdAt: Date;
        id: number;
        latitude: number | null;
        longitude: number | null;
    }[]>;
    findOne(id: number): Promise<{
        name: string;
        email: string | null;
        createdAt: Date;
        id: number;
        latitude: number | null;
        longitude: number | null;
    }>;
    create(dto: CreatePharmacyDto): Promise<{
        name: string;
        email: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        id: number;
    }>;
    update(id: number, dto: UpdatePharmacyDto): Promise<{
        name: string;
        email: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        id: number;
    }>;
    remove(id: number): Promise<{
        message: string;
    }>;
    updateLocation(id: number, lat: number, lon: number): Promise<{
        id: number;
        latitude: number | null;
        longitude: number | null;
        ok: boolean;
    }>;
}
