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
var PaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const razorpay_service_1 = require("./razorpay.service");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../utils/audit.service");
const notification_service_1 = require("../utils/notification.service");
const rider_payments_service_1 = require("../riders/rider-payments.service");
const lock_service_1 = require("../utils/lock.service");
let PaymentsService = PaymentsService_1 = class PaymentsService {
    constructor(prisma, razorpay, audit, notify, riderPayments, lock) {
        this.prisma = prisma;
        this.razorpay = razorpay;
        this.audit = audit;
        this.notify = notify;
        this.riderPayments = riderPayments;
        this.lock = lock;
        this.logger = new common_1.Logger(PaymentsService_1.name);
    }
    async createPaymentForOrder(orderId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!order)
            throw new common_1.BadRequestException('Order not found');
        if (process.env.LOADTEST_MODE === 'true') {
            const tx = await this.prisma.transaction.create({
                data: {
                    orderId,
                    provider: 'mock',
                    providerOrder: `mock_${orderId}`,
                    amount: Number(order.totalPrice) * 100,
                    currency: 'INR',
                    status: 'SUCCESS',
                },
            });
            const updatedOrder = await this.prisma.order.update({
                where: { id: orderId },
                data: { paymentStatus: 'PAID', paidAt: new Date() },
            });
            await this.prisma.orderTimeline.create({
                data: {
                    orderId,
                    event: 'PAYMENT_CAPTURED',
                    data: JSON.stringify({
                        transactionId: tx.id,
                        provider: tx.provider,
                        amount: Number(tx.amount) / 100,
                        currency: tx.currency,
                        mock: true,
                    }),
                },
            });
            await this.notify.createDomainEvent(updatedOrder.customerId, 'payment.captured', `Payment captured for order #${orderId}`, {
                orderId,
                transactionId: tx.id,
                amount: Number(tx.amount) / 100,
                currency: tx.currency,
                mock: true,
            });
            if (updatedOrder.pharmacyId) {
                await this.notify.createDomainEvent(updatedOrder.pharmacyId, 'payment.captured', `Payment captured for order #${orderId}`, {
                    orderId,
                    transactionId: tx.id,
                    amount: Number(tx.amount) / 100,
                    currency: tx.currency,
                    mock: true,
                });
            }
            return { mock: true, transaction: tx };
        }
        const amountPaise = Math.round(Number(order.totalPrice) * 100);
        const rzpOrder = await this.razorpay.createOrder(amountPaise, 'INR', `order_${orderId}`);
        const tx = await this.prisma.transaction.create({
            data: {
                orderId,
                provider: 'razorpay',
                providerOrder: rzpOrder.id,
                amount: amountPaise,
                currency: 'INR',
                status: 'CREATED',
            },
        });
        return { razorpayOrder: rzpOrder, transaction: tx };
    }
    async handleWebhookEvent(event) {
        const type = event?.event;
        switch (type) {
            case 'payment.authorized':
            case 'payment.captured':
                return this.handlePaymentSuccess(event.payload.payment.entity);
            case 'payment.failed':
                return this.handlePaymentFailed(event.payload.payment.entity);
            default:
                this.logger.warn(`Unhandled webhook event: ${type}`);
        }
    }
    async handlePaymentSuccess(payment) {
        const providerOrder = payment.order_id;
        if (!providerOrder)
            return;
        const tx = await this.prisma.transaction.findFirst({
            where: { providerOrder },
        });
        if (!tx)
            return;
        if (tx.status === 'SUCCESS') {
            return;
        }
        const updatedTx = await this.prisma.transaction.update({
            where: { id: tx.id },
            data: {
                providerPayment: payment.id,
                status: 'SUCCESS',
                method: payment.method,
                rawData: JSON.parse(JSON.stringify(payment)),
            },
        });
        if (!tx.orderId)
            return;
        const order = await this.prisma.order.findUnique({
            where: { id: tx.orderId },
            select: { id: true, status: true, customerId: true, pharmacyId: true, paymentStatus: true },
        });
        if (!order)
            return;
        if (String(order.paymentStatus || '').toUpperCase() !== 'PAID') {
            await this.prisma.order.update({
                where: { id: tx.orderId },
                data: { paymentStatus: 'PAID', paidAt: new Date() },
            });
            await this.prisma.orderTimeline.create({
                data: {
                    orderId: tx.orderId,
                    event: 'PAYMENT_CAPTURED',
                    data: JSON.stringify({
                        transactionId: updatedTx.id,
                        provider: updatedTx.provider,
                        amount: Number(updatedTx.amount) / 100,
                        currency: updatedTx.currency,
                    }),
                },
            });
        }
        await this.notify.createDomainEvent(order.customerId, 'payment.captured', `Payment captured for order #${order.id}`, {
            orderId: order.id,
            transactionId: updatedTx.id,
            amount: Number(updatedTx.amount) / 100,
            currency: updatedTx.currency,
        });
        if (order.pharmacyId) {
            await this.notify.createDomainEvent(order.pharmacyId, 'payment.captured', `Payment captured for order #${order.id}`, {
                orderId: order.id,
                transactionId: updatedTx.id,
                amount: Number(updatedTx.amount) / 100,
                currency: updatedTx.currency,
            });
        }
        this.logger.log(`Payment success for order ${tx.orderId}`);
    }
    async devCaptureOrder(orderId, customerId) {
        return this.lock.withLock(`lock:devpay:${orderId}`, 8000, async () => {
            const order = await this.prisma.order.findUnique({
                where: { id: orderId },
                select: {
                    id: true,
                    customerId: true,
                    pharmacyId: true,
                    status: true,
                    totalPrice: true,
                    paymentStatus: true,
                },
            });
            if (!order)
                throw new common_1.BadRequestException('Order not found');
            if (order.customerId !== customerId)
                throw new common_1.BadRequestException('Not your order');
            const ps = String(order.paymentStatus || 'UNPAID').toUpperCase();
            if (ps === 'PAID')
                return { ok: true, already: true };
            if (ps !== 'REQUESTED') {
                throw new common_1.BadRequestException('Payment not requested for this order yet');
            }
            const st = String(order.status || '').toUpperCase();
            if (st !== String(client_1.OrderStatus.ACCEPTED) && st !== String(client_1.OrderStatus.ASSIGNED)) {
                throw new common_1.BadRequestException(`Cannot pay in status ${order.status}`);
            }
            const amountPaise = Math.round(Number(order.totalPrice) * 100);
            const tx = await this.prisma.transaction.create({
                data: {
                    orderId,
                    provider: 'dev',
                    providerOrder: `dev_${orderId}`,
                    providerPayment: `devpay_${Date.now()}`,
                    amount: amountPaise,
                    currency: 'INR',
                    status: 'SUCCESS',
                },
            });
            await this.prisma.order.update({
                where: { id: orderId },
                data: { paymentStatus: 'PAID', paidAt: new Date() },
            });
            await this.prisma.orderTimeline.create({
                data: {
                    orderId,
                    event: 'PAYMENT_CAPTURED',
                    data: JSON.stringify({
                        transactionId: tx.id,
                        provider: tx.provider,
                        amount: Number(tx.amount) / 100,
                        currency: tx.currency,
                        dev: true,
                    }),
                },
            });
            await this.notify.createDomainEvent(order.customerId, 'payment.captured', `Payment captured for order #${orderId}`, {
                orderId,
                transactionId: tx.id,
                amount: Number(tx.amount) / 100,
                currency: tx.currency,
                dev: true,
            });
            if (order.pharmacyId) {
                await this.notify.createDomainEvent(order.pharmacyId, 'payment.captured', `Payment captured for order #${orderId}`, {
                    orderId,
                    transactionId: tx.id,
                    amount: Number(tx.amount) / 100,
                    currency: tx.currency,
                    dev: true,
                });
            }
            return { ok: true, transaction: tx };
        });
    }
    async handlePaymentFailed(payment) {
        const providerOrder = payment.order_id;
        if (!providerOrder)
            return;
        const tx = await this.prisma.transaction.findFirst({
            where: { providerOrder },
        });
        if (!tx)
            return;
        await this.prisma.transaction.update({
            where: { id: tx.id },
            data: {
                providerPayment: payment.id,
                status: 'FAILED',
                rawData: JSON.parse(JSON.stringify(payment)),
            },
        });
        this.logger.warn(`Payment FAILED for order ${tx.orderId}`);
    }
    async refundTransaction(transactionId, amount, adminUserId) {
        return this.lock.withLock(`lock:tx:${transactionId}`, 8000, async () => {
            const tx = await this.prisma.transaction.findUnique({
                where: { id: transactionId },
            });
            if (!tx)
                throw new common_1.BadRequestException('Transaction not found');
            if (tx.status === 'REFUNDED') {
                return { ok: true, refunded: true, already: true };
            }
            const amountPaise = Number(tx.amount);
            if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
                throw new common_1.BadRequestException('Invalid transaction amount');
            }
            const maxRefundRupees = amountPaise / 100;
            if (amount != null) {
                const n = Number(amount);
                if (!Number.isFinite(n) || n <= 0) {
                    throw new common_1.BadRequestException('Invalid refund amount');
                }
                if (n > maxRefundRupees) {
                    throw new common_1.BadRequestException(`Refund amount exceeds charged amount (${maxRefundRupees})`);
                }
            }
            if (tx.status !== 'SUCCESS' && process.env.LOADTEST_MODE !== 'true') {
                throw new common_1.BadRequestException(`Cannot refund a non-success transaction (status=${tx.status})`);
            }
            if (tx.provider === 'razorpay' && !tx.providerPayment) {
                throw new common_1.BadRequestException('Cannot refund: missing providerPayment on transaction');
            }
            if (process.env.LOADTEST_MODE === 'true') {
                await this.prisma.transaction.update({
                    where: { id: transactionId },
                    data: { status: 'REFUNDED' },
                });
                if (tx.orderId) {
                    const order = await this.prisma.order.findUnique({
                        where: { id: tx.orderId },
                        select: { id: true, customerId: true, pharmacyId: true, riderId: true },
                    });
                    await this.prisma.orderTimeline.create({
                        data: {
                            orderId: tx.orderId,
                            event: 'PAYMENT_REFUNDED',
                            data: JSON.stringify({
                                transactionId,
                                amount: Number(amount ?? maxRefundRupees),
                                by: 'ADMIN',
                                adminUserId,
                                mock: true,
                            }),
                        },
                    });
                    if (order?.customerId) {
                        await this.notify.createDomainEvent(order.customerId, 'payment.refunded', `Refund processed for order #${order.id}`, { orderId: order.id, transactionId, amount: Number(amount ?? maxRefundRupees) });
                    }
                    if (order?.pharmacyId) {
                        await this.notify.createDomainEvent(order.pharmacyId, 'payment.refunded', `Refund processed for order #${order.id}`, { orderId: order.id, transactionId, amount: Number(amount ?? maxRefundRupees) });
                    }
                    if (order?.id) {
                        await this.riderPayments.handleRefundForOrder(order.id, {
                            transactionId,
                            amount: Number(amount ?? maxRefundRupees),
                            by: 'ADMIN',
                        });
                    }
                }
                await this.audit.logAdminAction({
                    userId: adminUserId,
                    action: 'REFUND',
                    resource: 'PAYMENT',
                    meta: {
                        transactionId,
                        orderId: tx.orderId,
                        amount: Number(tx.amount) / 100,
                        mock: true,
                    },
                });
                return { mock: true, refunded: true };
            }
            if (tx.provider !== 'razorpay') {
                await this.prisma.transaction.update({
                    where: { id: transactionId },
                    data: { status: 'REFUNDED' },
                });
                if (tx.orderId) {
                    const order = await this.prisma.order.findUnique({
                        where: { id: tx.orderId },
                        select: { id: true, customerId: true, pharmacyId: true, riderId: true },
                    });
                    await this.prisma.orderTimeline.create({
                        data: {
                            orderId: tx.orderId,
                            event: 'PAYMENT_REFUNDED',
                            data: JSON.stringify({
                                transactionId,
                                amount: Number(amount ?? maxRefundRupees),
                                by: 'ADMIN',
                                adminUserId,
                                provider: tx.provider,
                                localOnly: true,
                            }),
                        },
                    });
                    if (order?.customerId) {
                        await this.notify.createDomainEvent(order.customerId, 'payment.refunded', `Refund processed for order #${order.id}`, { orderId: order.id, transactionId, amount: Number(amount ?? maxRefundRupees) });
                    }
                    if (order?.pharmacyId) {
                        await this.notify.createDomainEvent(order.pharmacyId, 'payment.refunded', `Refund processed for order #${order.id}`, { orderId: order.id, transactionId, amount: Number(amount ?? maxRefundRupees) });
                    }
                    if (order?.id) {
                        await this.riderPayments.handleRefundForOrder(order.id, {
                            transactionId,
                            amount: Number(amount ?? maxRefundRupees),
                            by: 'ADMIN',
                        });
                    }
                }
                await this.audit.logAdminAction({
                    userId: adminUserId,
                    action: 'REFUND',
                    resource: 'PAYMENT',
                    meta: {
                        transactionId,
                        orderId: tx.orderId,
                        amount: Number(amount ?? maxRefundRupees),
                        provider: tx.provider,
                        localOnly: true,
                    },
                });
                return { ok: true, refunded: true, provider: tx.provider };
            }
            const refundAmountPaise = amount ? Math.round(amount * 100) : undefined;
            const refund = await this.razorpay.refundPayment(tx.providerPayment, refundAmountPaise);
            await this.prisma.transaction.update({
                where: { id: transactionId },
                data: {
                    status: 'REFUNDED',
                    rawData: JSON.parse(JSON.stringify(refund)),
                },
            });
            if (tx.orderId) {
                const order = await this.prisma.order.findUnique({
                    where: { id: tx.orderId },
                    select: { id: true, customerId: true, pharmacyId: true },
                });
                await this.prisma.orderTimeline.create({
                    data: {
                        orderId: tx.orderId,
                        event: 'PAYMENT_REFUNDED',
                        data: JSON.stringify({
                            transactionId,
                            amount: Number(refundAmountPaise ?? amountPaise) / 100,
                            by: 'ADMIN',
                            adminUserId,
                        }),
                    },
                });
                if (order?.customerId) {
                    this.notify.create(order.customerId, 'PAYMENT_REFUNDED', `Refund processed for order #${order.id}`, { orderId: order.id, transactionId }, adminUserId);
                    await this.notify.createDomainEvent(order.customerId, 'payment.refunded', `Refund processed for order #${order.id}`, {
                        orderId: order.id,
                        transactionId,
                        amount: Number(refundAmountPaise ?? amountPaise) / 100,
                    });
                }
                if (order?.pharmacyId) {
                    this.notify.create(order.pharmacyId, 'PAYMENT_REFUNDED', `Refund processed for order #${order.id}`, { orderId: order.id, transactionId }, adminUserId);
                    await this.notify.createDomainEvent(order.pharmacyId, 'payment.refunded', `Refund processed for order #${order.id}`, {
                        orderId: order.id,
                        transactionId,
                        amount: Number(refundAmountPaise ?? amountPaise) / 100,
                    });
                }
                if (order?.id) {
                    await this.riderPayments.handleRefundForOrder(order.id, {
                        transactionId,
                        amount: Number(refundAmountPaise ?? amountPaise) / 100,
                        by: 'ADMIN',
                    });
                }
            }
            await this.audit.logAdminAction({
                userId: adminUserId,
                action: 'REFUND',
                resource: 'PAYMENT',
                meta: {
                    transactionId,
                    orderId: tx.orderId,
                    amount: Number(refundAmountPaise ?? tx.amount) / 100,
                },
            });
            this.logger.log(`Refund completed for transaction ${transactionId}`);
            return refund;
        }, { waitMs: 50, retries: 40 });
    }
    async listTransactions() {
        return this.prisma.transaction.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        razorpay_service_1.RazorpayService,
        audit_service_1.AuditService,
        notification_service_1.NotificationService,
        rider_payments_service_1.RiderPaymentsService,
        lock_service_1.LockService])
], PaymentsService);
