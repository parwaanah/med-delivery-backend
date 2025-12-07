import { PrismaService } from '../utils/prisma.service';
export declare class AdminUsersController {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getAllUsers(): Promise<{
        total: number;
        users: {
            name: string;
            email: string | null;
            role: import(".prisma/client").$Enums.UserRole;
            status: string;
            id: number;
        }[];
    }>;
    getPendingUsers(): Promise<{
        total: number;
        users: {
            name: string;
            email: string | null;
            role: import(".prisma/client").$Enums.UserRole;
            status: string;
            id: number;
        }[];
    }>;
    approveUser(id: number): Promise<{
        name: string;
        email: string | null;
        password: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        phone: string | null;
        status: string;
        createdAt: Date;
        id: number;
        googleId: string | null;
        otpCode: string | null;
        otpExpiresAt: Date | null;
        approvedBy: number | null;
        latitude: number | null;
        longitude: number | null;
        updatedAt: Date;
        deletedAt: Date | null;
    }>;
    rejectUser(id: number): Promise<{
        name: string;
        email: string | null;
        password: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        phone: string | null;
        status: string;
        createdAt: Date;
        id: number;
        googleId: string | null;
        otpCode: string | null;
        otpExpiresAt: Date | null;
        approvedBy: number | null;
        latitude: number | null;
        longitude: number | null;
        updatedAt: Date;
        deletedAt: Date | null;
    }>;
    deleteUser(id: number): Promise<{
        message: string;
    }>;
}
