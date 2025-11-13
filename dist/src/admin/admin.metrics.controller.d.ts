import { PrismaService } from '../utils/prisma.service';
export declare class AdminMetricsController {
    private prisma;
    constructor(prisma: PrismaService);
    getMetrics(): Promise<{
        orders: {
            total: number;
        };
        users: {
            count: number;
        };
        pharmacies: {
            count: number;
        };
        riders: {
            count: number;
        };
        system: {
            hostname: string;
            platform: NodeJS.Platform;
            cpuLoad1m: string;
            totalMemMB: number;
            usedMemMB: number;
            uptimeMinutes: number;
        };
        redis: string;
        database: {
            activeConnections: number;
        };
        node: {
            rssMB: number;
            heapUsedMB: number;
            heapTotalMB: number;
        };
        timestamp: string;
    }>;
}
