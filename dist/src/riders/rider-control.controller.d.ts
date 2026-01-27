import { Request } from 'express';
import { PrismaService } from '../utils/prisma.service';
import { AuditService } from '../utils/audit.service';
import { WsGateway } from '../ws/ws.gateway';
import { RiderShiftService } from './rider-shift.service';
export declare class RiderControlController {
    private readonly prisma;
    private readonly audit;
    private readonly ws;
    private readonly shift;
    constructor(prisma: PrismaService, audit: AuditService, ws: WsGateway, shift: RiderShiftService);
    setLifecycle(req: Request & {
        user: any;
    }, body: {
        state: 'ACTIVE' | 'OFFLINE';
    }): Promise<{
        ok: boolean;
        status: string;
    }>;
    setAvailability(req: Request & {
        user: any;
    }, body: {
        state: 'ONLINE' | 'OFFLINE';
    }): Promise<{
        ok: boolean;
        state: string;
        shiftId: any;
    } | {
        ok: boolean;
        ended: boolean;
        durationSec?: undefined;
        activeSec?: undefined;
        idleSec?: undefined;
        state: string;
        shiftId?: undefined;
    } | {
        ok: boolean;
        ended: boolean;
        durationSec: number;
        activeSec: number;
        idleSec: number;
        state: string;
        shiftId?: undefined;
    }>;
    heartbeat(req: Request & {
        user: any;
    }): Promise<{
        ok: boolean;
    }>;
    currentShift(req: Request & {
        user: any;
    }): Promise<{
        active: boolean;
        session?: undefined;
    } | {
        active: boolean;
        session: any;
    }>;
}
