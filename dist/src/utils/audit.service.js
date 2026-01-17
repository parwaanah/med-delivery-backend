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
const ws_gateway_1 = require("../ws/ws.gateway");
let AuditService = AuditService_1 = class AuditService {
    constructor(prisma, ws) {
        this.prisma = prisma;
        this.ws = ws;
        this.logger = new common_1.Logger(AuditService_1.name);
    }
    async log(params) {
        try {
            return await this.prisma.auditLog.create({
                data: {
                    userId: params.userId,
                    action: params.eventType,
                    resource: 'AUTH',
                    meta: {
                        email: params.email,
                        role: params.role,
                        success: params.success,
                        ip: params.ip,
                        userAgent: params.userAgent,
                        ...(params.meta || {}),
                    },
                },
            });
        }
        catch (err) {
            this.logger.error('Audit log failed', err);
            return null;
        }
    }
    async logAdminAction(params) {
        try {
            const record = await this.prisma.auditLog.create({
                data: {
                    userId: params.userId,
                    action: params.action,
                    resource: params.resource,
                    meta: params.meta,
                },
            });
            this.ws.notifyAdmins('admin_audit_event', {
                id: record.id,
                action: record.action,
                resource: record.resource,
                meta: record.meta,
                at: record.createdAt,
                userId: record.userId,
            });
            return record;
        }
        catch (err) {
            this.logger.error('Admin audit failed', err);
            return null;
        }
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = AuditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ws_gateway_1.WsGateway])
], AuditService);
