"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RiderInactivityCron_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiderInactivityCron = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const config_1 = require("@nestjs/config");
const audit_service_1 = require("../utils/audit.service");
const rider_shift_service_1 = require("./rider-shift.service");
const ws_gateway_1 = require("../ws/ws.gateway");
let RiderInactivityCron = RiderInactivityCron_1 = class RiderInactivityCron {
    constructor(config, shifts, audit, ws) {
        this.config = config;
        this.shifts = shifts;
        this.audit = audit;
        this.ws = ws;
        this.logger = new common_1.Logger(RiderInactivityCron_1.name);
    }
    inactivityMinutes() {
        const raw = this.config.get('RIDER_INACTIVITY_MINUTES') ??
            process.env.RIDER_INACTIVITY_MINUTES ??
            '15';
        const n = Number(raw);
        if (!Number.isFinite(n))
            return 15;
        return Math.min(Math.max(Math.floor(n), 3), 240);
    }
    async handleTimeouts() {
        if (process.env.DISABLE_RIDER_TIMEOUT === '1')
            return;
        const minutes = this.inactivityMinutes();
        const cutoffMs = Date.now() - minutes * 60_000;
        const ids = await this.shifts.getOnlineRiders();
        if (!ids.length)
            return;
        let timedOut = 0;
        for (const s of ids) {
            const riderId = Number(s);
            if (!Number.isFinite(riderId))
                continue;
            try {
                const hb = await this.shifts.getLastHeartbeatMs(riderId);
                if (hb != null && hb >= cutoffMs)
                    continue;
                await this.shifts.autoTimeout(riderId, minutes);
                await this.audit.logAdminAction({
                    userId: riderId,
                    action: 'RIDER_AUTO_TIMEOUT',
                    resource: `rider:${riderId}`,
                    meta: { minutes },
                });
                this.ws.notifyUser(riderId, 'rider.availability', {
                    state: 'OFFLINE',
                    reason: 'INACTIVITY_TIMEOUT',
                    minutes,
                });
                timedOut += 1;
            }
            catch (e) {
                this.logger.warn(`Timeout check failed for rider ${s}: ${e?.message || e}`);
            }
        }
        if (timedOut > 0) {
            this.logger.debug(`Auto-timed out riders: ${timedOut}`);
        }
    }
};
exports.RiderInactivityCron = RiderInactivityCron;
__decorate([
    (0, schedule_1.Cron)('*/1 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RiderInactivityCron.prototype, "handleTimeouts", null);
exports.RiderInactivityCron = RiderInactivityCron = RiderInactivityCron_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        rider_shift_service_1.RiderShiftService,
        audit_service_1.AuditService,
        ws_gateway_1.WsGateway])
], RiderInactivityCron);
