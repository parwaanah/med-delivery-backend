import { PrismaService } from '../utils/prisma.service';
import { WsGateway } from '../ws/ws.gateway';
export declare class AdminMetricsService {
    private prisma;
    constructor(prisma: PrismaService);
    getMetrics(): Promise<{
        users: {
            count: number;
        };
        ordersToday: {
            count: number;
        };
        ordersTotal: {
            count: number;
        };
        revenue: {
            amount: number;
        };
        activeRiders: {
            count: number;
        };
        surgeMultiplier: number;
    }>;
    emitMetrics(ws: WsGateway): Promise<{
        users: {
            count: number;
        };
        ordersToday: {
            count: number;
        };
        ordersTotal: {
            count: number;
        };
        revenue: {
            amount: number;
        };
        activeRiders: {
            count: number;
        };
        surgeMultiplier: number;
    }>;
}
