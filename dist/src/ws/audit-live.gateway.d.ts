import { Server } from 'socket.io';
export declare class AuditLiveGateway {
    server: Server;
    private readonly logger;
    emitAuditEvent(event: any): void;
}
