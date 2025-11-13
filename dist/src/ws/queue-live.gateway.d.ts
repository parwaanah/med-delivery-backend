import { OnGatewayInit } from '@nestjs/websockets';
import { Server } from 'socket.io';
export declare class QueueLiveGateway implements OnGatewayInit {
    server: Server;
    private redis;
    private queues;
    constructor();
    afterInit(): Promise<void>;
    private emitQueueSummary;
}
