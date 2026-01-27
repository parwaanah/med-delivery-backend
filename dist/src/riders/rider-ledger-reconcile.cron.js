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
var RiderLedgerReconcileCron_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiderLedgerReconcileCron = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../utils/prisma.service");
const rider_payments_service_1 = require("./rider-payments.service");
let RiderLedgerReconcileCron = RiderLedgerReconcileCron_1 = class RiderLedgerReconcileCron {
    constructor(prisma, riderPayments) {
        this.prisma = prisma;
        this.riderPayments = riderPayments;
        this.logger = new common_1.Logger(RiderLedgerReconcileCron_1.name);
    }
    async reconcile() {
        const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
        try {
            const delivered = await this.prisma.order.findMany({
                where: {
                    deliveredAt: { gte: since },
                    riderId: { not: null },
                    OR: [
                        { deliveryProofUrl: { not: null } },
                        { deliverySignatureUrl: { not: null } },
                        { deliveryOtp: { not: null } },
                    ],
                },
                select: {
                    id: true,
                    riderEarning: { select: { id: true } },
                },
                take: 500,
            });
            const missing = delivered.filter((o) => !o?.riderEarning).map((o) => o.id);
            for (const orderId of missing) {
                await this.riderPayments.ensureDeliveryEarningForOrder(orderId);
            }
            const refundedTxs = await this.prisma.transaction.findMany({
                where: {
                    status: 'REFUNDED',
                    createdAt: { gte: since },
                    orderId: { not: null },
                },
                select: { id: true, orderId: true, amount: true },
                take: 500,
            });
            for (const tx of refundedTxs) {
                const orderId = tx.orderId != null ? Number(tx.orderId) : NaN;
                if (!Number.isFinite(orderId))
                    continue;
                await this.riderPayments.handleRefundForOrder(orderId, {
                    transactionId: tx.id,
                    amount: Number(tx.amount) / 100,
                    by: 'SYSTEM',
                });
            }
            if (missing.length || refundedTxs.length) {
                this.logger.log(`Reconcile ok: created=${missing.length} refundsChecked=${refundedTxs.length}`);
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Reconcile failed: ${msg}`);
        }
    }
};
exports.RiderLedgerReconcileCron = RiderLedgerReconcileCron;
__decorate([
    (0, schedule_1.Cron)('*/10 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RiderLedgerReconcileCron.prototype, "reconcile", null);
exports.RiderLedgerReconcileCron = RiderLedgerReconcileCron = RiderLedgerReconcileCron_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        rider_payments_service_1.RiderPaymentsService])
], RiderLedgerReconcileCron);
