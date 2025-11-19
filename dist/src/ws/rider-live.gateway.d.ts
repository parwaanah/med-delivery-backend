import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { RidersService } from '../riders/riders.service';
export declare class RiderLiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private riders;
    constructor(riders: RidersService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    updateLocation(client: Socket, data: {
        riderId: number;
        lat: number;
        lon: number;
    }): Promise<void>;
}
