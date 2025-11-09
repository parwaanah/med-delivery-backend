import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
export declare class AuditLiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly jwt;
    server: Server;
    private readonly logger;
    constructor(jwt: JwtService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    emitAuditEvent(event: any): void;
}
