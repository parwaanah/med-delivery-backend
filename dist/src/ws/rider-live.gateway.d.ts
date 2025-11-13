import { Server } from 'socket.io';
export declare class RiderLiveGateway {
    server: Server;
    private readonly logger;
    broadcast(event: string, data: any): void;
    notifyAdmins(event: string, data: any): void;
    handleRiderUpdate(payload: any): void;
}
