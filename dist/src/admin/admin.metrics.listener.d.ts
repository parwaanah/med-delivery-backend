import { AdminMetricsService } from './admin.metrics.service';
import { WsGateway } from '../ws/ws.gateway';
export declare class AdminMetricsListener {
    private readonly metrics;
    private readonly ws;
    private readonly logger;
    constructor(metrics: AdminMetricsService, ws: WsGateway);
    pushLiveMetrics(): Promise<void>;
}
