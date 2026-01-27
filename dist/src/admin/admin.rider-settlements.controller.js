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
exports.AdminRiderSettlementsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../utils/prisma.service");
const rider_payments_service_1 = require("../riders/rider-payments.service");
let AdminRiderSettlementsController = class AdminRiderSettlementsController {
    constructor(prisma, payments) {
        this.prisma = prisma;
        this.payments = payments;
    }
    async listBatches(limit) {
        const take = Math.min(200, Math.max(1, Number(limit) || 50));
        const items = await this.prisma.riderSettlementBatch.findMany({
            orderBy: { id: 'desc' },
            take,
        });
        return { items, take };
    }
    async batch(id) {
        const batchId = Number(id);
        if (isNaN(batchId))
            throw new common_1.BadRequestException('Invalid batch id');
        const batch = await this.prisma.riderSettlementBatch.findUnique({
            where: { id: batchId },
            include: {
                earnings: {
                    orderBy: { id: 'asc' },
                    include: { order: { select: { id: true, status: true } } },
                },
            },
        });
        if (!batch)
            throw new common_1.BadRequestException('Batch not found');
        return batch;
    }
    async createBatch(body, req) {
        const start = new Date(body?.periodStart);
        const end = new Date(body?.periodEnd);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw new common_1.BadRequestException('Invalid periodStart/periodEnd');
        }
        if (end <= start)
            throw new common_1.BadRequestException('periodEnd must be after start');
        return this.payments.createWeeklyBatch(start, end, Number(req.user.id));
    }
    async markPaid(id, req) {
        const batchId = Number(id);
        if (isNaN(batchId))
            throw new common_1.BadRequestException('Invalid batch id');
        return this.payments.markBatchPaid(batchId, Number(req.user.id));
    }
    async listEarnings(riderId, status, limit) {
        const take = Math.min(200, Math.max(1, Number(limit) || 50));
        const where = {};
        if (riderId) {
            const rid = Number(riderId);
            if (isNaN(rid))
                throw new common_1.BadRequestException('Invalid riderId');
            where.riderId = rid;
        }
        if (status)
            where.status = String(status).toUpperCase();
        const items = await this.prisma.riderEarning.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take,
            include: { order: { select: { id: true, status: true, riderId: true } } },
        });
        return { items, take };
    }
    async overrideEarning(id, body) {
        const earningId = Number(id);
        if (isNaN(earningId))
            throw new common_1.BadRequestException('Invalid earning id');
        const updated = await this.payments.adminOverrideEarning(earningId, body || {});
        if (!updated)
            throw new common_1.BadRequestException('Earning not found');
        return updated;
    }
};
exports.AdminRiderSettlementsController = AdminRiderSettlementsController;
__decorate([
    (0, common_1.Get)('batches'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminRiderSettlementsController.prototype, "listBatches", null);
__decorate([
    (0, common_1.Get)('batches/:id'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminRiderSettlementsController.prototype, "batch", null);
__decorate([
    (0, common_1.Post)('batches'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminRiderSettlementsController.prototype, "createBatch", null);
__decorate([
    (0, common_1.Patch)('batches/:id/paid'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminRiderSettlementsController.prototype, "markPaid", null);
__decorate([
    (0, common_1.Get)('earnings'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)('riderId')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AdminRiderSettlementsController.prototype, "listEarnings", null);
__decorate([
    (0, common_1.Patch)('earnings/:id/override'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminRiderSettlementsController.prototype, "overrideEarning", null);
exports.AdminRiderSettlementsController = AdminRiderSettlementsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    (0, common_1.Controller)('admin/riders/settlements'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        rider_payments_service_1.RiderPaymentsService])
], AdminRiderSettlementsController);
