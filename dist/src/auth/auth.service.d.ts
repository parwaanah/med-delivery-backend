import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../utils/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuditService } from '../utils/audit.service';
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
            email: string;
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
}
export default AuthService;
