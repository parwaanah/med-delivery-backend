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
var AuditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("./prisma.service");
const audit_live_gateway_1 = require("../ws/audit-live.gateway");
const notification_service_1 = require("./notification.service");
let AuditService = AuditService_1 = class AuditService {
    constructor(prisma, liveGateway, notification) {
        this.prisma = prisma;
        this.liveGateway = liveGateway;
        this.notification = notification;
        this.logger = new common_1.Logger(AuditService_1.name);
    }
    async log({ userId, email, ip, userAgent, eventType, role, success = true, }) {
        try {
            const record = await this.prisma.loginAudit.create({
                data: { userId, email, ip, userAgent, eventType, role, success },
            });
            this.liveGateway.emitAuditEvent({
                eventType,
                userId,
                email,
                role,
                success,
                timestamp: record.timestamp,
            });
            const toastType = success ? 'ok' : 'err';
            this.notification.sendAdminToast({
                type: toastType,
                title: `Audit • ${eventType}`,
                text: `${email ?? 'unknown'} (${role ?? 'N/A'})`,
            });
            return record;
        }
        catch (err) {
            this.logger.error('Audit log failed', err);
            return { error: true, message: 'Audit log failed' };
        }
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = AuditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_live_gateway_1.AuditLiveGateway,
        notification_service_1.NotificationService])
], AuditService);
