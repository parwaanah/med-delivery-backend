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
var RiderShiftService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiderShiftService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const redis_service_1 = require("../utils/redis.service");
const notification_service_1 = require("../utils/notification.service");
const ws_gateway_1 = require("../ws/ws.gateway");
let RiderShiftService = RiderShiftService_1 = class RiderShiftService {
    constructor(prisma, redis, notify, ws) {
        this.prisma = prisma;
        this.redis = redis;
        this.notify = notify;
        this.ws = ws;
        this.logger = new common_1.Logger(RiderShiftService_1.name);
    }
    availabilityKey(riderId) {
        return `rider:availability:${riderId}`;
    }
    heartbeatKey(riderId) {
        return `rider:heartbeat:${riderId}`;
    }
    shiftKey(riderId) {
        return `rider:shift:current:${riderId}`;
    }
    onlineSetKey() {
        return `rider:online:set`;
    }
    idleSinceKey(riderId) {
        return `rider:idle_since:${riderId}`;
    }
    ttlSec() {
        const n = Number(process.env.RIDER_AVAILABILITY_TTL_SEC || 300);
        if (!Number.isFinite(n))
            return 300;
        return Math.min(Math.max(Math.floor(n), 30), 3600);
    }
    async setAvailabilityCache(riderId, state) {
        const ttl = this.ttlSec();
        await this.redis.client.set(this.availabilityKey(riderId), state, { EX: ttl });
        if (state === 'ONLINE') {
            await this.redis.client.sAdd(this.onlineSetKey(), String(riderId));
        }
        else {
            await this.redis.client.sRem(this.onlineSetKey(), String(riderId));
        }
    }
    async heartbeat(riderId) {
        const ttl = this.ttlSec();
        await this.redis.client.set(this.heartbeatKey(riderId), String(Date.now()), {
            EX: ttl,
        });
        const cur = await this.redis.client.get(this.availabilityKey(riderId));
        if (cur === 'ONLINE') {
            await this.redis.client.set(this.availabilityKey(riderId), 'ONLINE', {
                EX: ttl,
            });
        }
        const currentShiftId = await this.redis.client.get(this.shiftKey(riderId));
        if (currentShiftId) {
            await this.prisma.riderShiftSession.update({
                where: { id: Number(currentShiftId) },
                data: { lastHeartbeat: new Date() },
            });
        }
    }
    async getCurrentShiftId(riderId) {
        const cached = await this.redis.client.get(this.shiftKey(riderId));
        if (cached && Number.isFinite(Number(cached)))
            return Number(cached);
        const row = await this.prisma.riderShiftSession.findFirst({
            where: { riderId, endTime: null },
            orderBy: { startTime: 'desc' },
            select: { id: true },
        });
        if (!row)
            return null;
        await this.redis.client.set(this.shiftKey(riderId), String(row.id), {
            EX: this.ttlSec(),
        });
        return Number(row.id);
    }
    computeDeltaSec(from, to) {
        const fromMs = new Date(from).getTime();
        const toMs = to.getTime();
        if (!Number.isFinite(fromMs) || !Number.isFinite(toMs))
            return 0;
        return Math.max(0, Math.floor((toMs - fromMs) / 1000));
    }
    async transitionShiftState(riderId, newState, now = new Date()) {
        const id = await this.getCurrentShiftId(riderId);
        if (!id)
            return;
        const current = await this.prisma.riderShiftSession.findUnique({
            where: { id },
            select: { lastState: true, lastStateAt: true, activeSec: true, idleSec: true },
        });
        if (!current)
            return;
        const delta = this.computeDeltaSec(current.lastStateAt, now);
        const data = {
            lastState: newState,
            lastStateAt: now,
            lastHeartbeat: now,
        };
        if (String(current.lastState).toUpperCase() === 'ACTIVE') {
            data.activeSec = Number(current.activeSec || 0) + delta;
        }
        else {
            data.idleSec = Number(current.idleSec || 0) + delta;
        }
        await this.prisma.riderShiftSession.update({
            where: { id },
            data,
        });
        try {
            if (newState === 'IDLE') {
                await this.redis.client.set(this.idleSinceKey(riderId), String(now.getTime()), {
                    EX: this.ttlSec(),
                });
            }
            else {
                await this.redis.client.del(this.idleSinceKey(riderId));
            }
        }
        catch { }
    }
    async startShift(riderId) {
        const open = await this.prisma.riderShiftSession.findFirst({
            where: { riderId, endTime: null },
            orderBy: { startTime: 'desc' },
        });
        if (open) {
            await this.redis.client.set(this.shiftKey(riderId), String(open.id), {
                EX: this.ttlSec(),
            });
            await this.setAvailabilityCache(riderId, 'ONLINE');
            await this.heartbeat(riderId);
            return open;
        }
        const user = await this.prisma.user.findUnique({
            where: { id: riderId },
            select: { id: true, role: true, status: true, riderAvailability: true },
        });
        if (!user || String(user.role).toUpperCase() !== 'RIDER') {
            throw new common_1.BadRequestException('Rider not found');
        }
        if (String(user.status).toUpperCase() !== 'ACTIVE') {
            throw new common_1.BadRequestException('Rider must be ACTIVE to start shift');
        }
        const now = new Date();
        const startState = String(user.riderAvailability).toUpperCase() === 'BUSY'
            ? 'ACTIVE'
            : 'IDLE';
        const created = await this.prisma.riderShiftSession.create({
            data: {
                riderId,
                startTime: now,
                lastState: startState,
                lastStateAt: now,
                lastHeartbeat: now,
            },
        });
        await this.prisma.user.update({
            where: { id: riderId },
            data: { riderAvailability: 'AVAILABLE' },
        });
        await this.redis.client.set(this.shiftKey(riderId), String(created.id), {
            EX: this.ttlSec(),
        });
        await this.setAvailabilityCache(riderId, 'ONLINE');
        await this.heartbeat(riderId);
        try {
            if (startState === 'IDLE') {
                await this.redis.client.set(this.idleSinceKey(riderId), String(now.getTime()), {
                    EX: this.ttlSec(),
                });
            }
            else {
                await this.redis.client.del(this.idleSinceKey(riderId));
            }
        }
        catch { }
        this.ws.notifyUser(riderId, 'rider.availability', { state: 'ONLINE' });
        return created;
    }
    async endShift(riderId, reason) {
        const id = await this.getCurrentShiftId(riderId);
        if (!id) {
            await this.setAvailabilityCache(riderId, 'OFFLINE');
            return { ok: true, ended: false };
        }
        const now = new Date();
        const cur = await this.prisma.riderShiftSession.findUnique({
            where: { id },
            select: {
                startTime: true,
                lastState: true,
                lastStateAt: true,
                activeSec: true,
                idleSec: true,
            },
        });
        if (!cur)
            return { ok: true, ended: false };
        const delta = this.computeDeltaSec(cur.lastStateAt, now);
        let activeSec = Number(cur.activeSec || 0);
        let idleSec = Number(cur.idleSec || 0);
        if (String(cur.lastState).toUpperCase() === 'ACTIVE')
            activeSec += delta;
        else
            idleSec += delta;
        const durationSec = this.computeDeltaSec(cur.startTime, now);
        await this.prisma.riderShiftSession.update({
            where: { id },
            data: {
                endTime: now,
                durationSec,
                activeSec,
                idleSec,
                endedReason: reason || null,
            },
        });
        await this.prisma.user.update({
            where: { id: riderId },
            data: { riderAvailability: 'OFFLINE' },
        });
        await this.setAvailabilityCache(riderId, 'OFFLINE');
        await this.redis.client.del(this.shiftKey(riderId));
        await this.redis.client.del(this.heartbeatKey(riderId));
        await this.redis.client.del(this.idleSinceKey(riderId));
        this.ws.notifyUser(riderId, 'rider.availability', { state: 'OFFLINE', reason });
        return { ok: true, ended: true, durationSec, activeSec, idleSec };
    }
    async getIdleSinceMs(riderId) {
        const v = await this.redis.client.get(this.idleSinceKey(riderId));
        const n = v ? Number(v) : NaN;
        return Number.isFinite(n) ? n : null;
    }
    async setAvailability(riderId, state) {
        if (state === 'ONLINE') {
            const shift = await this.startShift(riderId);
            return { ok: true, state: 'ONLINE', shiftId: shift.id };
        }
        const ended = await this.endShift(riderId, 'MANUAL_OFFLINE');
        return { state: 'OFFLINE', ...ended };
    }
    async currentShift(riderId) {
        const id = await this.getCurrentShiftId(riderId);
        if (!id)
            return { active: false };
        const row = await this.prisma.riderShiftSession.findUnique({
            where: { id },
        });
        return { active: true, session: row };
    }
    async autoTimeout(riderId, minutes) {
        const ended = await this.endShift(riderId, 'AUTO_TIMEOUT');
        await this.notify.create(riderId, 'RIDER_INACTIVITY_TIMEOUT', `You were set OFFLINE due to ${minutes} minutes of inactivity`, { minutes });
        return ended;
    }
    async getOnlineRiders() {
        try {
            return await this.redis.client.sMembers(this.onlineSetKey());
        }
        catch {
            return [];
        }
    }
    async getLastHeartbeatMs(riderId) {
        const v = await this.redis.client.get(this.heartbeatKey(riderId));
        const n = v ? Number(v) : NaN;
        return Number.isFinite(n) ? n : null;
    }
};
exports.RiderShiftService = RiderShiftService;
exports.RiderShiftService = RiderShiftService = RiderShiftService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        notification_service_1.NotificationService,
        ws_gateway_1.WsGateway])
], RiderShiftService);
