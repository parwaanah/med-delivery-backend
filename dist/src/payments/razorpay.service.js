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
var RazorpayService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RazorpayService = void 0;
const razorpay_1 = __importDefault(require("razorpay"));
const common_1 = require("@nestjs/common");
let RazorpayService = RazorpayService_1 = class RazorpayService {
    constructor() {
        this.logger = new common_1.Logger(RazorpayService_1.name);
        this.client = new razorpay_1.default({
            key_id: process.env.RAZORPAY_KEY_ID || '',
            key_secret: process.env.RAZORPAY_KEY_SECRET || '',
        });
    }
    async createOrder(amountInPaise, currency = 'INR', receipt) {
        const opts = {
            amount: amountInPaise,
            currency,
            receipt: receipt ?? `receipt_${Date.now()}`,
            payment_capture: 1,
        };
        const order = await this.client.orders.create(opts);
        this.logger.log(`Razorpay order created ${order.id}`);
        return order;
    }
    verifyWebhookSignature(rawBody, signature, secret) {
        const webhookSecret = secret ?? process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) {
            this.logger.warn('Razorpay webhook secret not set');
            return false;
        }
        const crypto = require('crypto');
        const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
        return expected === signature;
    }
    async refundPayment(paymentId, amountInPaise) {
        const payload = amountInPaise ? { amount: amountInPaise } : {};
        return this.client.payments.refund(paymentId, payload);
    }
};
exports.RazorpayService = RazorpayService;
exports.RazorpayService = RazorpayService = RazorpayService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], RazorpayService);
