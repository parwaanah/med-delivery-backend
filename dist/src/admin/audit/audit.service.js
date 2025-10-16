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
const prisma_service_1 = require("../../../prisma/prisma.service");
const request_context_1 = require("../../common/context/request-context");
let AuditService = AuditService_1 = class AuditService {
    prisma;
    logger = new common_1.Logger(AuditService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async record(actorId, actorRole, action, targetType, targetId, extra) {
        try {
            const reqId = request_context_1.RequestContext.getRequestId();
            const { id: userId, role: userRole } = request_context_1.RequestContext.getUser();
            const meta = {
                ...extra,
                requestId: reqId,
                triggeredBy: { userId, userRole },
                timestamp: new Date().toISOString(),
            };
            await this.prisma.auditLog.create({
                data: {
                    actorId,
                    actorRole,
                    action,
                    targetType,
                    targetId: targetId ?? null,
                    createdAt: new Date(),
                    details: meta,
                },
            });
            this.logger.log(`[reqId:${reqId}] [${actorRole}] ${action} → ${targetType} (${targetId || '-'}) by ${userRole}#${userId}`);
        }
        catch (err) {
            this.logger.error(`❌ Audit Log Error: ${err.message}`, err.stack);
        }
    }
    async getAllLogs() {
        return this.prisma.auditLog.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }
    async filterLogs(role, targetType, fromDate, toDate) {
        const where = {};
        if (role)
            where.actorRole = role;
        if (targetType)
            where.targetType = targetType;
        if (fromDate || toDate) {
            where.createdAt = {
                gte: fromDate ? new Date(fromDate) : undefined,
                lte: toDate ? new Date(toDate) : undefined,
            };
        }
        const logs = await this.prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
        if (!logs.length)
            throw new common_1.BadRequestException('No matching logs found');
        return logs;
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = AuditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditService);
//# sourceMappingURL=audit.service.js.map