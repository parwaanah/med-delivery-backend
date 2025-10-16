import { AuthService } from './auth.service';
import type { Request as ExpressRequest } from 'express';
interface LoginDto {
    email: string;
    password: string;
}
interface SignupDto {
    name: string;
    email: string;
    password: string;
    role?: string;
}
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login({ email, password }: LoginDto): Promise<{
        status: string;
        message: string;
        data: {
            message: string;
            accessToken: string;
            refreshToken: string;
            user: {
                id: number;
                name: string;
                email: string;
                role: import(".prisma/client").$Enums.Role;
                createdAt: Date;
            };
        };
    }>;
    signup({ name, email, password, role }: SignupDto): Promise<{
        status: string;
        message: string;
        data: {
            message: string;
            accessToken: string;
            refreshToken: string;
            user: {
                id: number;
                name: string;
                email: string;
                role: import(".prisma/client").$Enums.Role;
                createdAt: Date;
            };
        };
    }>;
    getProfile(req: ExpressRequest): Promise<{
        status: string;
        message: string;
        data: {
            name: string;
            email: string;
            role: import(".prisma/client").$Enums.Role;
            createdAt: Date;
            id: number;
        };
    }>;
    saveDeviceToken(req: any, body: {
        token: string;
    }): Promise<{
        status: string;
        message: string;
    }>;
    refresh(body: {
        userId: number;
        refreshToken: string;
    }): Promise<{
        status: string;
        message: string;
        data: {
            message: string;
            accessToken: string;
            refreshToken: string;
        };
    }>;
    logout(req: any): Promise<{
        status: string;
        message: string;
    }>;
}
export {};
