import { PrismaService } from '../utils/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        name: string;
        email: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        id: number;
    }[]>;
    findOne(id: number): Promise<{
        name: string;
        email: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        id: number;
    }>;
    update(id: number, dto: UpdateUserDto): Promise<{
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
    remove(id: number): Promise<{
        message: string;
    }>;
}
