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
let PaymentsService = PaymentsService_1 = class PaymentsService {
    constructor(prisma, razorpay, audit) {
        this.prisma = prisma;
        this.razorpay = razorpay;
        this.audit = audit;
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
            await this.prisma.order.update({
                where: { id: orderId },
                data: { status: client_1.OrderStatus.PAID },
            });
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
        await this.prisma.transaction.update({
            where: { id: tx.id },
            data: {
                providerPayment: payment.id,
                status: 'SUCCESS',
                method: payment.method,
                rawData: JSON.parse(JSON.stringify(payment)),
            },
        });
        if (tx.orderId) {
            await this.prisma.order.update({
                where: { id: tx.orderId },
                data: { status: client_1.OrderStatus.PAID },
            });
        }
        this.logger.log(`Payment success for order ${tx.orderId}`);
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
        const tx = await this.prisma.transaction.findUnique({
            where: { id: transactionId },
        });
        if (!tx)
            throw new common_1.BadRequestException('Transaction not found');
        if (tx.status === 'REFUNDED')
            throw new common_1.BadRequestException('Transaction already refunded');
        if (process.env.LOADTEST_MODE === 'true') {
            await this.prisma.transaction.update({
                where: { id: transactionId },
                data: { status: 'REFUNDED' },
            });
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
        const refundAmountPaise = amount
            ? Math.round(amount * 100)
            : undefined;
        const refund = await this.razorpay.refundPayment(tx.providerPayment, refundAmountPaise);
        await this.prisma.transaction.update({
            where: { id: transactionId },
            data: {
                status: 'REFUNDED',
                rawData: JSON.parse(JSON.stringify(refund)),
            },
        });
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
        audit_service_1.AuditService])
], PaymentsService);
