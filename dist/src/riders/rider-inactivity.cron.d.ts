import { ConfigService } from '@nestjs/config';
import { AuditService } from '../utils/audit.service';
import { RiderShiftService } from './rider-shift.service';
import { WsGateway } from '../ws/ws.gateway';
export declare class RiderInactivityCron {
    private readonly config;
    private readonly shifts;
    private readonly audit;
    private readonly ws;
    private readonly logger;
    constructor(config: ConfigService, shifts: RiderShiftService, audit: AuditService, ws: WsGateway);
    private inactivityMinutes;
    handleTimeouts(): Promise<void>;
}
