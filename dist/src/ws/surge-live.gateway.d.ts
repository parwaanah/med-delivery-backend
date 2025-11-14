import { Server } from 'socket.io';
export declare class SurgeLiveGateway {
    server: Server;
    private readonly logger;
    broadcastSurge(payload: any): void;
}
