import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../utils/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
export declare class AuthService {
    private prisma;
    private jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    register(data: RegisterDto): Promise<{
        accessToken: string;
        user: {
            id: any;
            name: any;
            email: any;
            role: any;
        };
    }>;
    login(data: LoginDto, ip?: string, userAgent?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: number;
            name: string;
            email: string;
            role: import(".prisma/client").$Enums.UserRole;
        };
    }>;
    refreshToken(oldToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    revokeSession(sessionId: number): Promise<void>;
    validateUser(userId: string | number): Promise<{
        name: string;
        email: string;
        password: string;
        role: import(".prisma/client").$Enums.UserRole;
        status: string | null;
        latitude: number | null;
        longitude: number | null;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        id: number;
    } | null>;
    private generateToken;
}
