import { PrismaService } from '../utils/prisma.service';
export declare class NotificationsService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        message: string;
        type: string;
        meta: import("@prisma/client/runtime/library").JsonValue | null;
        status: string;
        createdAt: Date;
        id: number;
        senderId: number | null;
        receiverId: number;
    }[]>;
}
