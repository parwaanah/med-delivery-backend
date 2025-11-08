import { OnGatewayInit } from '@nestjs/websockets';
import { Server } from 'socket.io';
export declare class SurgeLiveGateway implements OnGatewayInit {
    server: Server;
    private readonly logger;
    afterInit(): void;
    broadcastSurge(data: any): void;
}
