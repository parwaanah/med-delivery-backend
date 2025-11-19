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
let PaymentsService = PaymentsService_1 = class PaymentsService {
    constructor(prisma, rzp) {
        this.prisma = prisma;
        this.rzp = rzp;
        this.logger = new common_1.Logger(PaymentsService_1.name);
    }
    async createPaymentForOrder(orderId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.BadRequestException('Order not found');
        if (order.status === client_1.OrderStatus.PAID) {
            throw new common_1.BadRequestException('Order is already paid');
        }
        const amount = Number(order.totalPrice ?? 0);
        if (amount <= 0)
            throw new common_1.BadRequestException('Invalid order amount');
        const amountInPaise = Math.round(amount * 100);
        const rzpOrder = await this.rzp.createOrder(amountInPaise, 'INR', `order_${orderId}`);
        const tx = await this.prisma.transaction.create({
            data: {
                orderId: order.id,
                provider: 'razorpay',
                providerOrder: rzpOrder?.id ?? null,
                providerPayment: null,
                amount: amount,
                currency: 'INR',
                status: 'created',
                rawData: rzpOrder,
            },
        });
        return { rzpOrder, transaction: tx };
    }
    async handleWebhookEvent(payload) {
        const event = payload?.event ?? 'unknown';
        const paymentEntity = payload?.payload?.payment?.entity ??
            payload?.payload?.payment_entity?.entity ??
            payload?.payload?.payment_entity ??
            null;
        const rzpOrderId = paymentEntity?.order_id ??
            payload?.payload?.order?.entity?.id ??
            payload?.payload?.order_entity?.entity?.id ??
            null;
        try {
            await this.prisma.paymentAttempt.create({
                data: {
                    providerOrder: rzpOrderId ?? null,
                    attemptData: payload,
                },
            });
        }
        catch (err) {
            this.logger.warn('Failed saving paymentAttempt audit', err?.message ?? err);
        }
        try {
            await this.prisma.transaction.updateMany({
                where: { providerOrder: rzpOrderId ?? '' },
                data: {
                    providerPayment: paymentEntity?.id ?? undefined,
                    status: (paymentEntity?.status ?? event),
                    method: paymentEntity?.method ?? undefined,
                    rawData: payload,
                },
            });
        }
        catch (err) {
            this.logger.warn('Failed updating transaction(s)', err?.message ?? err);
        }
        const tx = await this.prisma.transaction.findFirst({
            where: { providerOrder: rzpOrderId ?? '' },
        });
        if (!tx) {
            this.logger.warn(`Webhook for unknown transaction: ${rzpOrderId}`);
            return { ok: true };
        }
        const successStatuses = ['captured', 'authorized', 'paid'];
        const statusFromProvider = String(paymentEntity?.status ?? event).toLowerCase();
        if (successStatuses.includes(statusFromProvider)) {
            const orderIdNum = Number(tx.orderId);
            if (!isNaN(orderIdNum)) {
                try {
                    await this.prisma.order.update({
                        where: { id: orderIdNum },
                        data: { status: client_1.OrderStatus.PAID },
                    });
                }
                catch (err) {
                    this.logger.warn('Failed marking order PAID', err?.message ?? err);
                }
            }
            else {
                this.logger.warn(`Invalid orderId on tx: ${tx.id} orderId=${tx.orderId}`);
            }
        }
        this.logger.log(`Webhook processed: ${event}`);
        return { ok: true };
    }
    async refundTransaction(txId, amount) {
        const tx = await this.prisma.transaction.findUnique({ where: { id: txId } });
        if (!tx)
            throw new common_1.BadRequestException('Transaction not found');
        if (!tx.providerPayment)
            throw new common_1.BadRequestException('Cannot refund — payment ID missing');
        const amountInPaise = amount ? Math.round(amount * 100) : undefined;
        const refund = await this.rzp.refundPayment(tx.providerPayment, amountInPaise);
        await this.prisma.transaction.create({
            data: {
                orderId: tx.orderId,
                provider: 'razorpay',
                providerOrder: tx.providerOrder,
                providerPayment: tx.providerPayment,
                amount: amount ?? 0,
                currency: 'INR',
                status: 'refund_initiated',
                rawData: refund,
            },
        });
        return refund;
    }
    async listTransactions() {
        return this.prisma.transaction.findMany({
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, razorpay_service_1.RazorpayService])
], PaymentsService);
