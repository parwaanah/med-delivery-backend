import { PrismaService } from '../utils/prisma.service';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { Prisma } from '@prisma/client';
import { PharmacyProfileDto } from './dto/profile.dto';
export declare class ProfileController {
    private prisma;
    private cloud;
    constructor(prisma: PrismaService, cloud: CloudinaryService);
    getMyProfile(req: any): Promise<{
        role: import(".prisma/client").$Enums.UserRole;
        userId: number;
        data: Prisma.JsonValue;
        createdAt: Date;
        id: number;
        updatedAt: Date;
    } | null>;
    saveMyProfile(req: any, data: PharmacyProfileDto): Promise<{
        role: import(".prisma/client").$Enums.UserRole;
        userId: number;
        data: Prisma.JsonValue;
        createdAt: Date;
        id: number;
        updatedAt: Date;
    }>;
    getStatus(req: any): Promise<{
        profileComplete: boolean;
        docsUploaded: boolean;
        docsVerified: boolean;
        accountStatus: string;
    }>;
    uploadDocument(req: any, file: any, type: string): Promise<{
        userId: number;
        createdAt: Date;
        id: number;
        updatedAt: Date;
        type: string;
        url: string;
        verified: boolean;
    }>;
    listDocuments(req: any): Promise<{
        userId: number;
        createdAt: Date;
        id: number;
        updatedAt: Date;
        type: string;
        url: string;
        verified: boolean;
    }[]>;
}
