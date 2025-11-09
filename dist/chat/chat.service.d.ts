import { PrismaService } from '../utils/prisma.service';
export declare class ChatService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    saveMessage(senderId: number, receiverId: number, text: string): Promise<{
        createdAt: Date;
        id: number;
        senderId: number;
        receiverId: number;
        text: string;
    }>;
    getMessagesBetweenUsers(a: number, b: number): Promise<{
        createdAt: Date;
        id: number;
        senderId: number;
        receiverId: number;
        text: string;
    }[]>;
}
