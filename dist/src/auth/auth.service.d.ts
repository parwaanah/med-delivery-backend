import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../utils/prisma.service";
import { LoginDto, RegisterDto, VerifyOtpDto, SendOtpDto } from "./dto/auth.dto";
import { AuditService } from "../utils/audit.service";
export declare class AuthService {
    private prisma;
    private jwtService;
    private audit;
    private readonly logger;
    constructor(prisma: PrismaService, jwtService: JwtService, audit: AuditService);
    register(data: RegisterDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: any;
            name: any;
            email: any;
            role: any;
            status: any;
        };
    }>;
    login(data: LoginDto, ip?: string, ua?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: any;
            name: any;
            email: any;
            role: any;
            status: any;
        };
    }>;
    verifyEmail(token: string): Promise<{
        message: string;
    }>;
    verifyOtp(data: VerifyOtpDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: any;
            name: any;
            email: any;
            role: any;
            status: any;
        };
    }>;
    sendOtp(data: SendOtpDto): Promise<{
        otp?: string | undefined;
        message: string;
    }>;
    refresh(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: any;
            name: any;
            email: any;
            role: any;
            status: any;
        };
    }>;
    logout(userId: number): Promise<{
        message: string;
    }>;
    private issueTokens;
}
