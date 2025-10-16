import { OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { $Enums } from '@prisma/client';
export declare class AuthService implements OnModuleDestroy {
    private readonly jwtService;
    constructor(jwtService: JwtService);
    signup(name: string, email: string, password: string, role?: string): Promise<{
        message: string;
        accessToken: string;
        refreshToken: string;
        user: {
            id: number;
            name: string;
            email: string;
            role: $Enums.Role;
            createdAt: Date;
        };
    }>;
    login(email: string, password: string): Promise<{
        message: string;
        accessToken: string;
        refreshToken: string;
        user: {
            id: number;
            name: string;
            email: string;
            role: $Enums.Role;
            createdAt: Date;
        };
    }>;
    refreshTokens(userId: number, refreshToken: string): Promise<{
        message: string;
        accessToken: string;
        refreshToken: string;
    }>;
    logout(userId: number): Promise<{
        message: string;
    }>;
    private generateTokens;
    private saveRefreshToken;
    onModuleDestroy(): Promise<void>;
}
