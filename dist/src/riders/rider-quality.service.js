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
var RiderQualityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiderQualityService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const ws_gateway_1 = require("../ws/ws.gateway");
const notification_service_1 = require("../utils/notification.service");
const audit_service_1 = require("../utils/audit.service");
const client_1 = require("@prisma/client");
let RiderQualityService = RiderQualityService_1 = class RiderQualityService {
    constructor(prisma, ws, notify, audit) {
        this.prisma = prisma;
        this.ws = ws;
        this.notify = notify;
        this.audit = audit;
        this.logger = new common_1.Logger(RiderQualityService_1.name);
    }
    strikeWindowDays() {
        const n = Number(process.env.RIDER_STRIKE_WINDOW_DAYS || 30);
        return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 1), 365) : 30;
    }
    suspendThresholdPoints() {
        const n = Number(process.env.RIDER_STRIKE_SUSPEND_POINTS || 10);
        return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 1), 200) : 10;
    }
    rapidRejectWindowSec() {
        const n = Number(process.env.RIDER_RAPID_REJECT_WINDOW_SEC || 300);
        return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 30), 3600) : 300;
    }
    rapidRejectThreshold() {
        const n = Number(process.env.RIDER_RAPID_REJECT_THRESHOLD || 3);
        return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 1), 50) : 3;
    }
    async strikePointsSince(riderId, since) {
        const agg = await this.prisma.riderStrike.aggregate({
            where: { riderId, createdAt: { gte: since } },
            _sum: { points: true },
        });
        return Number(agg?._sum?.points ?? 0);
    }
    async maybeAutoSuspend(riderId, meta) {
        const user = await this.prisma.user.findUnique({
            where: { id: riderId },
            select: { id: true, role: true, status: true },
        });
        if (!user || String(user.role) !== String(client_1.UserRole.RIDER))
            return;
        if (String(user.status).toUpperCase() === 'SUSPENDED')
            return;
        const since = new Date(Date.now() - this.strikeWindowDays() * 24 * 60 * 60 * 1000);
        const points = await this.strikePointsSince(riderId, since);
        const threshold = this.suspendThresholdPoints();
        if (points < threshold)
            return;
        await this.prisma.user.update({
            where: { id: riderId },
            data: {
                status: 'SUSPENDED',
                riderAvailability: 'OFFLINE',
                riderReasonCode: 'FRAUD',
                riderReasonNote: `Auto-suspended: strike points ${points}/${threshold}`,
            },
        });
        this.ws.notifyUser(riderId, 'user.status', { status: 'SUSPENDED' });
        this.ws.notifyAdmins('rider.auto_suspended', {
            riderId,
            points,
            threshold,
            meta: meta ?? null,
        });
        try {
            await this.notify.create(riderId, 'ACCOUNT_SUSPENDED', 'Your rider account was suspended due to safety policy violations. Contact support.', { code: 'FRAUD', points, threshold, meta }, undefined);
        }
        catch { }
        try {
            await this.audit.logAdminAction({
                action: 'RIDER_AUTO_SUSPENDED',
                resource: `rider:${riderId}`,
                meta: { points, threshold, ...(meta || {}) },
            });
        }
        catch { }
    }
    async recordRating(params) {
        const order = await this.prisma.order.findUnique({
            where: { id: params.orderId },
        });
        if (!order)
            throw new common_1.BadRequestException('Order not found');
        if (order.customerId !== params.customerId) {
            throw new common_1.ForbiddenException('Not your order');
        }
        if (order.status !== client_1.OrderStatus.DELIVERED) {
            throw new common_1.BadRequestException('Order not delivered yet');
        }
        if (!order.riderId) {
            throw new common_1.BadRequestException('Order has no rider');
        }
        const rating = Math.floor(Number(params.rating));
        if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
            throw new common_1.BadRequestException('rating must be 1..5');
        }
        const comment = params.comment != null ? String(params.comment).trim().slice(0, 500) : null;
        const existing = await this.prisma.riderRating.findUnique({
            where: { orderId: params.orderId },
            select: { id: true },
        });
        if (existing)
            throw new common_1.BadRequestException('Rating already submitted');
        await this.prisma.riderRating.create({
            data: {
                orderId: params.orderId,
                riderId: order.riderId,
                customerId: params.customerId,
                rating,
                comment,
            },
        });
        const rider = await this.prisma.user.findUnique({
            where: { id: order.riderId },
            select: { id: true, riderAvgRating: true, riderRatingCount: true },
        });
        const count = Number(rider?.riderRatingCount ?? 0);
        const avg = Number(rider?.riderAvgRating ?? 0);
        const nextCount = count + 1;
        const nextAvg = nextCount > 0 ? (avg * count + rating) / nextCount : rating;
        await this.prisma.user.update({
            where: { id: order.riderId },
            data: { riderAvgRating: Number(nextAvg.toFixed(2)), riderRatingCount: nextCount },
        });
        this.ws.notifyAdmins('rider.rating', {
            riderId: order.riderId,
            orderId: params.orderId,
            rating,
            avg: Number(nextAvg.toFixed(2)),
            count: nextCount,
        });
        return { ok: true };
    }
    async addStrike(params) {
        const points = Math.min(Math.max(Math.floor(Number(params.points || 1)), 1), 100);
        const type = String(params.type || 'UNKNOWN').slice(0, 60);
        const reason = params.reason != null ? String(params.reason).trim().slice(0, 200) : null;
        await this.prisma.riderStrike.create({
            data: {
                riderId: params.riderId,
                type,
                points,
                reason,
                meta: params.meta ?? null,
            },
        });
        this.ws.notifyAdmins('rider.strike', {
            riderId: params.riderId,
            type,
            points,
            reason,
        });
        await this.maybeAutoSuspend(params.riderId, { type, points, reason, meta: params.meta });
        return { ok: true };
    }
    async addFraudSignal(params) {
        const type = String(params.type || 'UNKNOWN').slice(0, 60);
        const severity = Math.min(Math.max(Math.floor(Number(params.severity ?? 50)), 1), 100);
        await this.prisma.riderFraudSignal.create({
            data: {
                riderId: params.riderId,
                type,
                severity,
                meta: params.meta ?? null,
            },
        });
        this.ws.notifyAdmins('rider.fraud', {
            riderId: params.riderId,
            type,
            severity,
            meta: params.meta ?? null,
        });
        if (params.strikePoints && params.strikePoints > 0) {
            await this.addStrike({
                riderId: params.riderId,
                type,
                points: params.strikePoints,
                reason: params.reason,
                meta: params.meta,
            });
        }
        else {
            await this.maybeAutoSuspend(params.riderId, { type, severity, meta: params.meta });
        }
        return { ok: true };
    }
    async onRiderRejectedOffer(riderId) {
        const windowSec = this.rapidRejectWindowSec();
        const threshold = this.rapidRejectThreshold();
        const since = new Date(Date.now() - windowSec * 1000);
        const count = await this.prisma.orderOffer.count({
            where: {
                riderId,
                offeredTo: 'RIDER',
                status: 'REJECTED',
                respondedAt: { gte: since },
            },
        });
        if (count < threshold)
            return { ok: true };
        await this.addFraudSignal({
            riderId,
            type: 'RAPID_REJECTS',
            severity: 70,
            strikePoints: 3,
            reason: `Rejected ${count} offers in ${windowSec}s`,
            meta: { count, windowSec },
        });
        return { ok: true };
    }
    async summary(riderId) {
        const user = await this.prisma.user.findUnique({
            where: { id: riderId },
            select: { id: true, status: true, riderAvgRating: true, riderRatingCount: true },
        });
        if (!user)
            throw new common_1.BadRequestException('Rider not found');
        const since = new Date(Date.now() - this.strikeWindowDays() * 24 * 60 * 60 * 1000);
        const strikePoints30d = await this.strikePointsSince(riderId, since);
        const recentSignals = await this.prisma.riderFraudSignal.findMany({
            where: { riderId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        const recentStrikes = await this.prisma.riderStrike.findMany({
            where: { riderId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        return {
            riderId,
            status: user.status,
            rating: {
                avg: Number(user.riderAvgRating ?? 0),
                count: Number(user.riderRatingCount ?? 0),
            },
            strikes: {
                windowDays: this.strikeWindowDays(),
                suspendThresholdPoints: this.suspendThresholdPoints(),
                pointsInWindow: strikePoints30d,
                recent: recentStrikes,
            },
            fraudSignals: recentSignals,
        };
    }
};
exports.RiderQualityService = RiderQualityService;
exports.RiderQualityService = RiderQualityService = RiderQualityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ws_gateway_1.WsGateway,
        notification_service_1.NotificationService,
        audit_service_1.AuditService])
], RiderQualityService);
