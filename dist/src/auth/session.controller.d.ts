import { PrismaService } from '../utils/prisma.service';
export declare class SessionController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getUserSessions(userId: number): Promise<{
        createdAt: Date;
        id: number;
        ip: string | null;
        userAgent: string | null;
        expiresAt: Date;
    }[]>;
    revokeSession(sessionId: number): Promise<{
        message: string;
    }>;
}
