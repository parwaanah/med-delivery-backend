import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
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
            email: string;
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
}
