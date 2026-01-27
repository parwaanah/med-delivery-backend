import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { RiderTelemetryService } from '../riders/rider-telemetry.service';
export declare class RiderLiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private telemetry;
    constructor(telemetry: RiderTelemetryService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    updateLocation(client: Socket, data: {
        riderId: number;
        lat: number;
        lon: number;
        accuracyM?: number;
        speedMps?: number;
        headingDeg?: number;
        tsMs?: number;
    }): Promise<void>;
}
