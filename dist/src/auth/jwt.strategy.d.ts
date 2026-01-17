import { Strategy } from "passport-jwt";
import { PrismaService } from "../utils/prisma.service";
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly prisma;
    constructor(prisma: PrismaService);
    validate(payload: any): Promise<{
        name: string;
        email: string | null;
        password: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        phone: string | null;
        createdAt: Date;
        id: number;
        googleId: string | null;
        emailVerified: boolean;
        phoneVerified: boolean;
        otpCode: string | null;
        otpExpiresAt: Date | null;
        status: string;
        approvedBy: number | null;
        latitude: number | null;
        longitude: number | null;
        updatedAt: Date;
        deletedAt: Date | null;
    } | null>;
}
export {};
