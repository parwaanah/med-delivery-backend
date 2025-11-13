import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
interface SurgeBroadcast {
    multiplier: number;
    demand: number;
    supply: number;
    timestamp: number;
    override?: boolean;
}
export declare class SurgeLiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
    server: Server;
    private readonly logger;
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    broadcastSurge(data: SurgeBroadcast): void;
}
export {};
