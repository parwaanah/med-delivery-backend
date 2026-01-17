import { PrismaService } from '../utils/prisma.service';
export declare class AdminUsersController {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    list(role?: string, status?: string): Promise<{
        total: number;
        users: {
            name: string;
            email: string | null;
            password: string | null;
            role: import(".prisma/client").$Enums.UserRole;
            phone: string | null;
            createdAt: Date;
            id: number;
            googleId: string | null;
            emailVerified: boolean;
            phoneVerified: boolean;
            otpCode: string | null;
            otpExpiresAt: Date | null;
            status: string;
            approvedBy: number | null;
            latitude: number | null;
            longitude: number | null;
            updatedAt: Date;
            deletedAt: Date | null;
        }[];
    }>;
    getPendingByRole(role: string): Promise<{
        total: number;
        users: {
            name: string;
            email: string | null;
            password: string | null;
            role: import(".prisma/client").$Enums.UserRole;
            phone: string | null;
            createdAt: Date;
            id: number;
            googleId: string | null;
            emailVerified: boolean;
            phoneVerified: boolean;
            otpCode: string | null;
            otpExpiresAt: Date | null;
            status: string;
            approvedBy: number | null;
            latitude: number | null;
            longitude: number | null;
            updatedAt: Date;
            deletedAt: Date | null;
        }[];
    }>;
    approveUser(req: any, id: string): Promise<{
        name: string;
        email: string | null;
        password: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        phone: string | null;
        createdAt: Date;
        id: number;
        googleId: string | null;
        emailVerified: boolean;
        phoneVerified: boolean;
        otpCode: string | null;
        otpExpiresAt: Date | null;
        status: string;
        approvedBy: number | null;
        latitude: number | null;
        longitude: number | null;
        updatedAt: Date;
        deletedAt: Date | null;
    }>;
    rejectUser(req: any, id: string): Promise<{
        name: string;
        email: string | null;
        password: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        phone: string | null;
        createdAt: Date;
        id: number;
        googleId: string | null;
        emailVerified: boolean;
        phoneVerified: boolean;
        otpCode: string | null;
        otpExpiresAt: Date | null;
        status: string;
        approvedBy: number | null;
        latitude: number | null;
        longitude: number | null;
        updatedAt: Date;
        deletedAt: Date | null;
    }>;
    deleteUser(id: string): Promise<{
        message: string;
    }>;
}
