import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../utils/prisma.service';
export declare class AdminAuditGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private prisma;
    private readonly logger;
    server: Server;
    constructor(prisma: PrismaService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    broadcastAuditEvent(event: string, payload: any): Promise<void>;
    notifyLoginActivity(data: {
        userId?: number;
        email?: string;
        ip?: string;
        userAgent?: string;
        eventType: string;
        success: boolean;
        role?: string;
    }): Promise<void>;
}
