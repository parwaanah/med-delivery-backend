import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../utils/prisma.service';
export declare class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private prisma;
    server: Server;
    private readonly logger;
    constructor(prisma: PrismaService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    notifyUser(userId: number, event: string, payload: any): void;
    broadcast(event: string, payload: any): void;
}
export declare class WsModule {
}
