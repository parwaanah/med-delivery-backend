import { PrismaService } from '../utils/prisma.service';
export declare class NotificationsService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        message: string;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
        id: number;
        status: string;
        type: string;
        senderId: number | null;
        receiverId: number;
    }[]>;
}
