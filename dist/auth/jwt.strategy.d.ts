import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../utils/prisma.service';
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly configService;
    private readonly prisma;
    constructor(configService: ConfigService, prisma: PrismaService);
    validate(payload: any): Promise<{
        name: string;
        email: string;
        password: string;
        role: import(".prisma/client").$Enums.UserRole;
        status: string;
        createdAt: Date;
        id: number;
        approvedBy: number | null;
        latitude: number | null;
        longitude: number | null;
        updatedAt: Date;
        deletedAt: Date | null;
    } | null>;
}
export {};
