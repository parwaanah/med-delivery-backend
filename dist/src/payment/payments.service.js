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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const stripe_1 = __importDefault(require("stripe"));
const prisma_service_1 = require("../utils/prisma.service");
const config_1 = require("@nestjs/config");
const notification_service_1 = require("../utils/notification.service");
let PaymentsService = class PaymentsService {
    constructor(prisma, config, notify) {
        this.prisma = prisma;
        this.config = config;
        this.notify = notify;
        this.stripe = new stripe_1.default(this.config.get('STRIPE_SECRET_KEY') || '');
        this.webhookSecret = this.config.get('STRIPE_WEBHOOK_SECRET') || '';
    }
    async createPaymentIntent(amount, userId) {
        if (!amount || amount < 1)
            throw new common_1.BadRequestException('Invalid payment amount.');
        const paymentIntent = await this.stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: 'usd',
            metadata: { userId: String(userId) },
        });
        await this.notify.sendAdminToast({
            type: 'info',
            title: 'Payment Created',
            text: `Payment intent ${paymentIntent.id} for user ${userId}`,
        });
        return {
            clientSecret: paymentIntent.client_secret,
            id: paymentIntent.id,
            amount,
        };
    }
    async handleWebhook(rawBody, signature) {
        let event;
        try {
            event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
        }
        catch {
            throw new common_1.BadRequestException('⚠️ Invalid webhook signature.');
        }
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const intent = event.data.object;
                await this.notify.sendAdminToast({
                    type: 'ok',
                    title: 'Payment Success',
                    text: `Payment ${intent.id} succeeded for user ${intent.metadata.userId}`,
                });
                await this.prisma.order.updateMany({
                    where: { customerId: Number(intent.metadata.userId), status: 'PENDING' },
                    data: { status: 'ACCEPTED' },
                });
                break;
            }
            case 'payment_intent.payment_failed': {
                const failed = event.data.object;
                await this.notify.sendAdminToast({
                    type: 'err',
                    title: 'Payment Failed',
                    text: `Payment ${failed.id} failed`,
                });
                break;
            }
            default:
                break;
        }
        return { received: true };
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        notification_service_1.NotificationService])
], PaymentsService);
