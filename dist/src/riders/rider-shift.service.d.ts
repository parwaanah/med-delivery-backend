import { PrismaService } from '../utils/prisma.service';
import { RedisService } from '../utils/redis.service';
import { NotificationService } from '../utils/notification.service';
import { WsGateway } from '../ws/ws.gateway';
type ShiftState = 'ACTIVE' | 'IDLE';
type AvailabilityState = 'ONLINE' | 'OFFLINE';
export declare class RiderShiftService {
    private readonly prisma;
    private readonly redis;
    private readonly notify;
    private readonly ws;
    private readonly logger;
    constructor(prisma: PrismaService, redis: RedisService, notify: NotificationService, ws: WsGateway);
    private availabilityKey;
    private heartbeatKey;
    private shiftKey;
    private onlineSetKey;
    private idleSinceKey;
    private ttlSec;
    setAvailabilityCache(riderId: number, state: AvailabilityState): Promise<void>;
    heartbeat(riderId: number): Promise<void>;
    private getCurrentShiftId;
    private computeDeltaSec;
    transitionShiftState(riderId: number, newState: ShiftState, now?: Date): Promise<void>;
    startShift(riderId: number): Promise<any>;
    endShift(riderId: number, reason?: string): Promise<{
        ok: boolean;
        ended: boolean;
        durationSec?: undefined;
        activeSec?: undefined;
        idleSec?: undefined;
    } | {
        ok: boolean;
        ended: boolean;
        durationSec: number;
        activeSec: number;
        idleSec: number;
    }>;
    getIdleSinceMs(riderId: number): Promise<number | null>;
    setAvailability(riderId: number, state: AvailabilityState): Promise<{
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
    currentShift(riderId: number): Promise<{
        active: boolean;
        session?: undefined;
    } | {
        active: boolean;
        session: any;
    }>;
    autoTimeout(riderId: number, minutes: number): Promise<{
        ok: boolean;
        ended: boolean;
        durationSec?: undefined;
        activeSec?: undefined;
        idleSec?: undefined;
    } | {
        ok: boolean;
        ended: boolean;
        durationSec: number;
        activeSec: number;
        idleSec: number;
    }>;
    getOnlineRiders(): Promise<string[]>;
    getLastHeartbeatMs(riderId: number): Promise<number | null>;
}
export {};
