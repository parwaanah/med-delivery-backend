import { PrismaService } from '../utils/prisma.service';
import { CloudinaryService } from '../uploads/cloudinary.service';
export declare class RiderProfileController {
    private prisma;
    private cloud;
    constructor(prisma: PrismaService, cloud: CloudinaryService);
    listDocs(req: any): Promise<{
        userId: number;
        createdAt: Date;
        id: number;
        updatedAt: Date;
        type: string;
        url: string;
        verified: boolean;
    }[]>;
    uploadDoc(req: any, file: any, body: any): Promise<{
        userId: number;
        createdAt: Date;
        id: number;
        updatedAt: Date;
        type: string;
        url: string;
        verified: boolean;
    }>;
}
