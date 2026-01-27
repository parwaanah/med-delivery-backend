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
exports.NotificationsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
let NotificationsController = class NotificationsController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(req) {
        const userId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
        return this.prisma.notification.findMany({
            where: { receiverId: userId },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
    async markRead(id, req) {
        const userId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
        const notifId = Number(id);
        if (isNaN(notifId))
            throw new common_1.BadRequestException('Invalid notification id');
        const notif = await this.prisma.notification.findUnique({
            where: { id: notifId },
        });
        if (!notif || notif.receiverId !== userId) {
            throw new common_1.BadRequestException('Notification not found');
        }
        await this.prisma.notification.update({
            where: { id: notifId },
            data: { status: 'READ' },
        });
        return { ok: true };
    }
    async markAllRead(req) {
        const userId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
        await this.prisma.notification.updateMany({
            where: {
                receiverId: userId,
                status: { not: 'READ' },
            },
            data: { status: 'READ' },
        });
        return { ok: true };
    }
};
exports.NotificationsController = NotificationsController;
__decorate([
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "list", null);
__decorate([
    (0, common_1.Patch)(':id/read'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "markRead", null);
__decorate([
    (0, common_1.Patch)('read-all'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "markAllRead", null);
exports.NotificationsController = NotificationsController = __decorate([
    (0, common_1.Controller)('notifications'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationsController);
