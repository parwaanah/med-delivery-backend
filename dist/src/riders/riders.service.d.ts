import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { GeoSurgeService } from '../geosurge/geo-surge.service';
import { SurgeService } from '../surge/surge.service';
import { WsGateway } from '../ws/ws.gateway';
export declare class RidersService {
    private prisma;
    private notify;
    private geo;
    private surge;
    private ws;
    private readonly logger;
    constructor(prisma: PrismaService, notify: NotificationService, geo: GeoSurgeService, surge: SurgeService, ws: WsGateway);
    updateLocationWS(riderId: number, lat: number, lon: number): Promise<void>;
    updateLocation(riderId: number, lat: number, lon: number): Promise<{
        ok: boolean;
    }>;
    updateStatus(riderId: number, status: 'AVAILABLE' | 'BUSY' | 'OFFLINE'): Promise<{
        ok: boolean;
    }>;
}
