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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const payments_service_1 = require("./payments.service");
const razorpay_service_1 = require("./razorpay.service");
const prisma_service_1 = require("../utils/prisma.service");
const create_intent_dto_1 = require("./dto/create-intent.dto");
const refund_dto_1 = require("./dto/refund.dto");
let PaymentsController = class PaymentsController {
    constructor(paymentsService, rzpService, prisma) {
        this.paymentsService = paymentsService;
        this.rzpService = rzpService;
        this.prisma = prisma;
    }
    async createIntent(body) {
        const orderId = Number(body.orderId);
        if (isNaN(orderId))
            throw new Error('Invalid orderId');
        return this.paymentsService.createPaymentForOrder(orderId);
    }
    async webhook(req, res, signature) {
        try {
            const raw = req.rawBody;
            if (!raw) {
                return res.status(400).send('raw body missing');
            }
            const valid = this.rzpService.verifyWebhookSignature(raw, signature);
            if (!valid) {
                return res.status(400).send('invalid signature');
            }
            const json = JSON.parse(raw.toString('utf8'));
            await this.paymentsService.handleWebhookEvent(json);
            return res.status(200).send('ok');
        }
        catch (err) {
            console.error('payments webhook error', err);
            return res.status(500).send('error');
        }
    }
    async refund(dto) {
        return this.paymentsService.refundTransaction(dto.transactionId, dto.amount);
    }
    async adminList() {
        return this.paymentsService.listTransactions();
    }
    async byOrder(orderId) {
        const idNum = Number(orderId);
        if (isNaN(idNum))
            return [];
        return this.prisma.transaction.findMany({ where: { orderId: idNum }, orderBy: { createdAt: 'desc' } });
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Post)('create-intent'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_intent_dto_1.CreateIntentDto]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "createIntent", null);
__decorate([
    (0, common_1.Post)('webhook'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Headers)('x-razorpay-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "webhook", null);
__decorate([
    (0, common_1.Post)('refund'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [refund_dto_1.RefundDto]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "refund", null);
__decorate([
    (0, common_1.Get)('admin/list'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "adminList", null);
__decorate([
    (0, common_1.Get)('by-order/:orderId'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "byOrder", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, common_1.Controller)('payments'),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService,
        razorpay_service_1.RazorpayService,
        prisma_service_1.PrismaService])
], PaymentsController);
