import { UserRole } from "@prisma/client";
export declare class RegisterDto {
    name: string;
    email?: string;
    phone?: string;
    password: string;
    role?: UserRole;
}
export declare class LoginDto {
    email?: string;
    phone?: string;
    password: string;
}
export declare class RefreshTokenDto {
    refreshToken: string;
}
export declare class SendOtpDto {
    phone: string;
}
export declare class VerifyOtpDto {
    phone: string;
    otp: string;
}
