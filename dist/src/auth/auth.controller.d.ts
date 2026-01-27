import { Request } from "express";
import { AuthService } from "./auth.service";
import { LoginDto, RegisterDto, VerifyOtpDto, SendOtpDto } from "./dto/auth.dto";
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    register(dto: RegisterDto): Promise<{
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
    login(req: Request, dto: LoginDto): Promise<{
        user: {
            id: any;
            name: any;
            email: any;
            role: any;
            status: any;
        };
        access_token: string;
        refresh_token: string;
    }>;
    refresh(token: string): Promise<{
        user: {
            id: any;
            name: any;
            email: any;
            role: any;
            status: any;
        };
        access_token: string;
        refresh_token: string;
    }>;
    logout(req: any): Promise<{
        message: string;
    }>;
    verifyEmail(token: string): Promise<{
        message: string;
    }>;
    verifyOtp(dto: VerifyOtpDto): Promise<{
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
    sendOtp(dto: SendOtpDto): Promise<{
        otp?: string | undefined;
        message: string;
    }>;
}
