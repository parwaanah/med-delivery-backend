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
var RiderPaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiderPaymentsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../utils/prisma.service");
const surge_service_1 = require("../surge/surge.service");
let RiderPaymentsService = RiderPaymentsService_1 = class RiderPaymentsService {
    constructor(prisma, config, surge) {
        this.prisma = prisma;
        this.config = config;
        this.surge = surge;
        this.logger = new common_1.Logger(RiderPaymentsService_1.name);
        this.baseFare = Number(this.config.get('RIDER_BASE_FARE') ?? 40);
        this.perKm = Number(this.config.get('RIDER_PER_KM') ?? 8);
        this.bonusPerOrder = Number(this.config.get('RIDER_BONUS_PER_ORDER') ?? 0);
        this.cancellationPenalty = Number(this.config.get('RIDER_CANCELLATION_PENALTY') ?? 25);
    }
    d(v) {
        return new client_1.Prisma.Decimal(Number.isFinite(v) ? v : 0);
    }
    haversineKm(lat1, lon1, lat2, lon2) {
        const toRad = (x) => (x * Math.PI) / 180;
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
    }
    async computeDistanceKm(orderId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: {
                customer: { select: { latitude: true, longitude: true } },
                pharmacy: { select: { latitude: true, longitude: true } },
            },
        });
        const c = order?.customer;
        const p = order?.pharmacy;
        if (!c ||
            !p ||
            c.latitude == null ||
            c.longitude == null ||
            p.latitude == null ||
            p.longitude == null) {
            return null;
        }
        const km = this.haversineKm(Number(p.latitude), Number(p.longitude), Number(c.latitude), Number(c.longitude));
        return Number.isFinite(km) ? Number(km.toFixed(2)) : null;
    }
    hasDeliveryProof(order) {
        const proofUrl = order.deliveryProofUrl ? String(order.deliveryProofUrl) : '';
        const signatureUrl = order.deliverySignatureUrl
            ? String(order.deliverySignatureUrl)
            : '';
        const otp = order.deliveryOtp ? String(order.deliveryOtp) : '';
        return Boolean(proofUrl.trim() || signatureUrl.trim() || otp.trim());
    }
    async ensureDeliveryEarningForOrder(orderId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                riderId: true,
                status: true,
                deliveredAt: true,
                deliveryProofUrl: true,
                deliverySignatureUrl: true,
                deliveryOtp: true,
            },
        });
        if (!order)
            return null;
        if (!order.riderId)
            return null;
        if (order.status !== client_1.OrderStatus.DELIVERED)
            return null;
        if (!order.deliveredAt)
            return null;
        if (!this.hasDeliveryProof(order))
            return null;
        const distanceKm = await this.computeDistanceKm(orderId);
        const surgeStatus = await this.surge
            .getStatus()
            .catch(() => ({ multiplier: 1 }));
        const multiplier = Number(surgeStatus?.multiplier ?? 1) || 1;
        const baseFare = this.baseFare;
        const distanceFare = distanceKm != null ? this.perKm * distanceKm : 0;
        const gross = baseFare + distanceFare;
        const surgeBonus = multiplier > 1 ? gross * (multiplier - 1) : 0;
        const bonus = this.bonusPerOrder;
        const penalty = 0;
        const net = gross + surgeBonus + bonus - penalty;
        const meta = {
            kind: 'DELIVERY',
            computedAt: new Date().toISOString(),
            proof: {
                proofUrl: order.deliveryProofUrl ?? null,
                signatureUrl: order.deliverySignatureUrl ?? null,
                otpProvided: Boolean(order.deliveryOtp),
            },
            config: {
                baseFare: this.baseFare,
                perKm: this.perKm,
                bonusPerOrder: this.bonusPerOrder,
                cancellationPenalty: this.cancellationPenalty,
            },
        };
        return this.prisma.riderEarning.upsert({
            where: { orderId },
            create: {
                orderId,
                riderId: order.riderId,
                type: 'EARNING',
                distanceKm,
                baseFare: this.d(baseFare),
                distanceFare: this.d(distanceFare),
                surgeMultiplier: multiplier,
                surgeBonus: this.d(surgeBonus),
                bonus: this.d(bonus),
                penalty: this.d(penalty),
                netAmount: this.d(net),
                status: 'PENDING',
                meta,
            },
            update: {
                distanceKm,
                baseFare: this.d(baseFare),
                distanceFare: this.d(distanceFare),
                surgeMultiplier: multiplier,
                surgeBonus: this.d(surgeBonus),
                bonus: this.d(bonus),
                netAmount: this.d(net),
                meta,
            },
        });
    }
    async handleRefundForOrder(orderId, opts) {
        const earning = await this.prisma.riderEarning.findUnique({
            where: { orderId },
        });
        if (!earning)
            return { ok: true, changed: false, missing: true };
        const status = String(earning.status || '').toUpperCase();
        if (status === 'SETTLED') {
            this.logger.warn(`Refund clawback skipped: rider earning already settled (orderId=${orderId})`);
            return { ok: true, changed: false, settled: true };
        }
        const nextMeta = {
            ...(earning.meta || {}),
            refund: {
                at: new Date().toISOString(),
                transactionId: opts?.transactionId ?? null,
                amount: opts?.amount ?? null,
                by: opts?.by ?? 'ADMIN',
            },
        };
        const updated = await this.prisma.riderEarning.update({
            where: { orderId },
            data: {
                netAmount: this.d(0),
                meta: nextMeta,
            },
        });
        return { ok: true, changed: true, updated };
    }
    async applyCancellationPenaltyForOrder(orderId, riderId, reason) {
        const penalty = Math.abs(this.cancellationPenalty);
        const existing = await this.prisma.riderEarning.findUnique({
            where: { orderId },
        });
        if (!existing) {
            return this.prisma.riderEarning.create({
                data: {
                    orderId,
                    riderId,
                    type: 'PENALTY',
                    distanceKm: null,
                    baseFare: this.d(0),
                    distanceFare: this.d(0),
                    surgeMultiplier: 1,
                    surgeBonus: this.d(0),
                    bonus: this.d(0),
                    penalty: this.d(penalty),
                    netAmount: this.d(-penalty),
                    status: 'PENDING',
                    meta: {
                        kind: 'CANCELLATION_PENALTY',
                        reason,
                        config: { cancellationPenalty: this.cancellationPenalty },
                    },
                },
            });
        }
        const curPenalty = Number(existing.penalty ?? 0);
        const curNet = Number(existing.netAmount ?? 0);
        const nextPenalty = curPenalty + penalty;
        const nextNet = curNet - penalty;
        const nextMeta = {
            ...(existing.meta || {}),
            penalties: [
                ...((existing.meta || {})?.penalties || []),
                { at: new Date().toISOString(), reason, amount: penalty },
            ],
        };
        return this.prisma.riderEarning.update({
            where: { orderId },
            data: {
                riderId,
                penalty: this.d(nextPenalty),
                netAmount: this.d(nextNet),
                meta: nextMeta,
            },
        });
    }
    async getSummary(riderId) {
        const now = new Date();
        const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const [earned, pendingAgg, last7days] = await Promise.all([
            this.prisma.riderEarning.aggregate({
                where: { riderId, type: 'EARNING' },
                _count: { _all: true },
                _sum: { netAmount: true },
            }),
            this.prisma.riderEarning.aggregate({
                where: { riderId, status: 'PENDING' },
                _sum: { netAmount: true },
            }),
            this.prisma.riderEarning.aggregate({
                where: { riderId, createdAt: { gte: last7 } },
                _sum: { netAmount: true },
                _count: { _all: true },
            }),
        ]);
        return {
            totalOrders: earned._count._all,
            revenue: Number(earned._sum.netAmount ?? 0),
            pendingPayout: Number(pendingAgg._sum.netAmount ?? 0),
            last7days: {
                items: last7days._count._all,
                net: Number(last7days._sum.netAmount ?? 0),
            },
        };
    }
    async getTransactions(riderId, query = {}) {
        const limit = Math.min(200, Math.max(1, query.limit ?? 50));
        const where = { riderId };
        if (query.status)
            where.status = String(query.status).toUpperCase();
        const rows = await this.prisma.riderEarning.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { order: { select: { id: true, status: true } } },
        });
        return {
            items: rows.map((r) => ({
                id: r.id,
                orderId: r.orderId,
                orderStatus: r.order?.status,
                type: r.type,
                createdAt: r.createdAt,
                distanceKm: r.distanceKm,
                baseFare: Number(r.baseFare),
                distanceFare: Number(r.distanceFare),
                surgeMultiplier: r.surgeMultiplier,
                surgeBonus: Number(r.surgeBonus),
                bonus: Number(r.bonus),
                penalty: Number(r.penalty),
                netAmount: Number(r.netAmount),
                status: r.status,
                batchId: r.batchId,
                settledAt: r.settledAt,
                meta: r.meta ?? null,
            })),
            limit,
        };
    }
    async createWeeklyBatch(periodStart, periodEnd, createdBy) {
        const existing = await this.prisma.riderSettlementBatch.findUnique({
            where: { periodStart_periodEnd: { periodStart, periodEnd } },
        });
        if (existing)
            return existing;
        const batch = await this.prisma.riderSettlementBatch.create({
            data: {
                periodStart,
                periodEnd,
                status: 'CREATED',
            },
        });
        const res = await this.prisma.riderEarning.updateMany({
            where: {
                type: { in: ['EARNING', 'BONUS', 'PENALTY'] },
                status: 'PENDING',
                batchId: null,
                createdAt: { gte: periodStart, lt: periodEnd },
            },
            data: { batchId: batch.id },
        });
        this.logger.log(`Created rider settlement batch #${batch.id} (${res.count} earnings)`);
        if (createdBy) {
            await this.prisma.riderSettlementBatch.update({
                where: { id: batch.id },
                data: {
                    status: batch.status,
                },
            });
        }
        return batch;
    }
    async markBatchPaid(batchId, paidBy) {
        const now = new Date();
        const batch = await this.prisma.riderSettlementBatch.update({
            where: { id: batchId },
            data: { status: 'PAID' },
        });
        await this.prisma.riderEarning.updateMany({
            where: { batchId, status: 'PENDING' },
            data: { status: 'SETTLED', settledAt: now },
        });
        if (paidBy) {
            this.logger.log(`Rider batch #${batchId} marked PAID by admin=${paidBy}`);
        }
        return batch;
    }
    async adminOverrideEarning(earningId, patch) {
        const current = await this.prisma.riderEarning.findUnique({
            where: { id: earningId },
        });
        if (!current)
            return null;
        const bonus = patch.bonus != null ? this.d(patch.bonus) : current.bonus;
        const penalty = patch.penalty != null ? this.d(Math.abs(patch.penalty)) : current.penalty;
        const net = new client_1.Prisma.Decimal(0)
            .plus(current.baseFare)
            .plus(current.distanceFare)
            .plus(current.surgeBonus)
            .plus(bonus)
            .minus(penalty);
        return this.prisma.riderEarning.update({
            where: { id: earningId },
            data: {
                bonus,
                penalty,
                netAmount: net,
            },
        });
    }
};
exports.RiderPaymentsService = RiderPaymentsService;
exports.RiderPaymentsService = RiderPaymentsService = RiderPaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        surge_service_1.SurgeService])
], RiderPaymentsService);
