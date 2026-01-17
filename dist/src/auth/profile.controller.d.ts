import { PrismaService } from '../utils/prisma.service';
import { CloudinaryService } from '../uploads/cloudinary.service';
export declare class ProfileController {
    private prisma;
    private cloud;
    constructor(prisma: PrismaService, cloud: CloudinaryService);
    getMyProfile(req: any): Promise<{
        role: import(".prisma/client").$Enums.UserRole;
        userId: number;
        data: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date;
        id: number;
        updatedAt: Date;
    } | null>;
    saveMyProfile(req: any, data: any): Promise<{
        role: import(".prisma/client").$Enums.UserRole;
        userId: number;
        data: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date;
        id: number;
        updatedAt: Date;
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
