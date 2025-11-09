import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../utils/prisma.service';
export declare class RiderLiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private prisma;
    server: Server;
    private readonly logger;
    constructor(prisma: PrismaService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    notifyAdmins(event: string, payload: any): void;
    broadcastRiderLocation(payload: {
        id: number;
        lat: number;
        lon: number;
        status: string;
        timestamp: number;
    }): void;
}
