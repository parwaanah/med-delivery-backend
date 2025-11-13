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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhooksService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const notification_service_1 = require("../utils/notification.service");
let WebhooksService = class WebhooksService {
    constructor(prisma, notify) {
        this.prisma = prisma;
        this.notify = notify;
    }
    async handlePharmacyCallback(key, payload) {
        if (key !== process.env.PHARMACY_WEBHOOK_KEY)
            throw new common_1.ForbiddenException('Invalid pharmacy key');
        const { orderId, status } = payload;
        await this.prisma.order.update({
            where: { id: orderId },
            data: { status },
        });
        await this.notify.sendAdminToast({
            type: 'info',
            title: 'Pharmacy Webhook',
            text: `Order #${orderId} → ${status}`,
        });
        return { ok: true };
    }
    async handleRiderCallback(key, payload) {
        if (key !== process.env.RIDER_WEBHOOK_KEY)
            throw new common_1.ForbiddenException('Invalid rider key');
        const { riderId, lat, lon } = payload;
        await this.prisma.user.update({
            where: { id: riderId },
            data: { latitude: lat, longitude: lon },
        });
        await this.notify.sendAdminToast({
            type: 'info',
            title: 'Rider Webhook',
            text: `Rider #${riderId} → (${lat}, ${lon})`,
        });
        return { ok: true };
    }
};
exports.WebhooksService = WebhooksService;
exports.WebhooksService = WebhooksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService])
], WebhooksService);
