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
exports.AdminAuditController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
let AdminAuditController = class AdminAuditController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAuditLogs(page, limit, userId, email, eventType, role, success) {
        const pageNum = Number(page) > 0 ? Number(page) : 1;
        const limitNum = Number(limit) > 0 ? Number(limit) : 100;
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (userId)
            where.userId = Number(userId);
        if (email)
            where.email = { contains: email, mode: 'insensitive' };
        if (eventType)
            where.eventType = eventType;
        if (role)
            where.role = role;
        if (success !== undefined)
            where.success = success === 'true' || success === '1';
        const [logs, total] = await this.prisma.$transaction([
            this.prisma.loginAudit.findMany({
                where,
                orderBy: { timestamp: 'desc' },
                skip,
                take: limitNum,
            }),
            this.prisma.loginAudit.count({ where }),
        ]);
        return {
            page: pageNum,
            limit: limitNum,
            total,
            logs,
        };
    }
    async getAuditStats() {
        const successCount = await this.prisma.loginAudit.count({
            where: { success: true, eventType: 'LOGIN_SUCCESS' },
        });
        const failedCount = await this.prisma.loginAudit.count({
            where: { success: false, eventType: 'LOGIN_FAILED' },
        });
        const totalEvents = await this.prisma.loginAudit.count();
        return {
            totalEvents,
            successCount,
            failedCount,
            successRate: totalEvents === 0 ? 0 : Math.round((successCount / totalEvents) * 100),
            lastUpdated: new Date().toISOString(),
        };
    }
};
exports.AdminAuditController = AdminAuditController;
__decorate([
    openapi.ApiOperation({ description: "\u2705 Fetch paginated or default (last 100) audit logs" }),
    (0, common_1.Get)('logs'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('userId')),
    __param(3, (0, common_1.Query)('email')),
    __param(4, (0, common_1.Query)('eventType')),
    __param(5, (0, common_1.Query)('role')),
    __param(6, (0, common_1.Query)('success')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AdminAuditController.prototype, "getAuditLogs", null);
__decorate([
    openapi.ApiOperation({ description: "\u2705 Simple audit statistics summary" }),
    (0, common_1.Get)('stats'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminAuditController.prototype, "getAuditStats", null);
exports.AdminAuditController = AdminAuditController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.Controller)('admin/audit'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminAuditController);
