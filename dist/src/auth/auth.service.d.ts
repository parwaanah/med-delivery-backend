import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../utils/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuditService } from '../utils/audit.service';
import { UserRole } from '@prisma/client';
export declare class AuthService {
    private prisma;
    private jwtService;
    private audit;
    private readonly logger;
    private readonly LOADTEST;
    constructor(prisma: PrismaService, jwtService: JwtService, audit: AuditService);
    register(data: RegisterDto): Promise<{
        accessToken: string;
        user: {
            id: any;
            name: any;
            email: any;
            role: any;
        };
    }>;
    login(data: LoginDto, ip?: string, ua?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        sessionId: number;
        user: {
            id: number;
            name: string;
            email: string | null;
            role: import(".prisma/client").$Enums.UserRole;
        };
    }>;
    refreshToken(oldToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
        sessionId: number;
    }>;
    requestPasswordReset(email: string): Promise<{
        message: string;
        resetLink: string;
    }>;
    logout(sessionId: number): Promise<{
        message: string;
    }>;
    private generateToken;
    sendOtp(data: {
        phone: string;
        role?: UserRole;
    }): Promise<{
        message: string;
    }>;
    verifyOtp(data: {
        phone: string;
        otp: string;
        role?: UserRole;
    }, ip: string, ua: string): Promise<{
        accessToken: string;
        refreshToken: string;
        sessionId: number;
        user: {
            id: number;
            name: string;
            phone: string | null;
            role: import(".prisma/client").$Enums.UserRole;
        };
    }>;
    googleLogin(googleUser: {
        email: string;
        googleId: string;
        name: string;
    }): Promise<{
        accessToken: string;
        refreshToken: string;
        sessionId: number;
        user: {
            id: number;
            name: string;
            email: string | null;
            role: import(".prisma/client").$Enums.UserRole;
        };
    }>;
}
