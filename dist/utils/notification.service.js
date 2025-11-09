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
var NotificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("./prisma.service");
const ws_gateway_1 = require("../ws/ws.gateway");
let NotificationService = NotificationService_1 = class NotificationService {
    constructor(prisma, ws) {
        this.prisma = prisma;
        this.ws = ws;
        this.logger = new common_1.Logger(NotificationService_1.name);
    }
    async create(receiverId, type, message, meta, senderId) {
        try {
            const n = await this.prisma.notification.create({
                data: {
                    senderId: senderId ?? null,
                    receiverId,
                    type,
                    message,
                    meta: meta ?? {},
                    status: 'UNREAD',
                },
            });
            try {
                this.ws.notifyUser(receiverId, 'notification', {
                    id: n.id,
                    type: n.type,
                    message: n.message,
                    meta: n.meta ?? {},
                    createdAt: n.createdAt,
                    status: n.status,
                });
            }
            catch (err) {
                this.logger.warn(`WS push failed for user ${receiverId}: ${err?.message}`);
            }
            if (type.startsWith('ORDER_')) {
                this.sendAdminToast({
                    type: 'info',
                    title: type.replace(/_/g, ' '),
                    text: message,
                    meta: { ...meta, receiverId, notifId: n.id },
                }).catch(() => { });
            }
            return n;
        }
        catch (err) {
            this.logger.error(`❌ Failed to create notification: ${err?.message}`);
            throw err;
        }
    }
    async sendAdminToast(payload) {
        try {
            const admins = await this.prisma.user.findMany({
                where: { role: 'ADMIN' },
                select: { id: true },
            });
            const meta = payload.meta ?? {};
            const logMessage = `[ADMIN] ${payload.title} • ${payload.text}`;
            for (const admin of admins) {
                await this.prisma.notification.create({
                    data: {
                        senderId: null,
                        receiverId: admin.id,
                        type: 'ADMIN_TOAST',
                        message: logMessage,
                        meta,
                    },
                }).catch(() => { });
            }
            try {
                this.ws.notifyAdmins('admin_toast', {
                    type: payload.type,
                    title: payload.title,
                    text: payload.text,
                    meta,
                    at: new Date().toISOString(),
                });
            }
            catch (err) {
                this.logger.warn(`⚠️ WS broadcast failed: ${err?.message}`);
            }
        }
        catch (err) {
            this.logger.error(`❌ sendAdminToast failed: ${err?.message}`);
        }
    }
    async markRead(notificationId, userId) {
        const n = await this.prisma.notification.findUnique({ where: { id: notificationId } });
        if (!n || n.receiverId !== userId)
            return null;
        return this.prisma.notification.update({
            where: { id: notificationId },
            data: { status: 'READ' },
        });
    }
    async listForUser(userId, page = 1, limit = 25) {
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.prisma.notification.findMany({
                where: { receiverId: userId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.notification.count({ where: { receiverId: userId } }),
        ]);
        return { items, total, page, limit };
    }
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = NotificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ws_gateway_1.WsGateway])
], NotificationService);
