import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto, SendOtpDto, VerifyOtpDto } from './dto/auth.dto';
export declare class AuthController {
    private auth;
    constructor(auth: AuthService);
    register(dto: RegisterDto): Promise<{
        accessToken: string;
        user: {
            id: any;
            name: any;
            email: any;
            role: any;
        };
    }>;
    login(req: Request, dto: LoginDto): Promise<{
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
    refresh(dto: RefreshTokenDto): Promise<{
        accessToken: string;
        refreshToken: string;
        sessionId: number;
    }>;
    logout(sessionId: number): Promise<{
        message: string;
    }>;
    sendOtp(dto: SendOtpDto): Promise<{
        message: string;
    }>;
    verifyOtp(req: Request, dto: VerifyOtpDto): Promise<{
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
    googleAuth(): void;
    googleCallback(req: any): Promise<{
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
