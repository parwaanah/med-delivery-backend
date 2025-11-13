import { Server } from 'socket.io';
export declare class GeoSurgeLiveGateway {
    private readonly logger;
    server: Server;
    broadcastGeo(zones: any[]): void;
}
