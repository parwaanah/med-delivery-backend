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
exports.RiderControlController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../utils/prisma.service");
const audit_service_1 = require("../utils/audit.service");
const ws_gateway_1 = require("../ws/ws.gateway");
const rider_shift_service_1 = require("./rider-shift.service");
let RiderControlController = class RiderControlController {
    constructor(prisma, audit, ws, shift) {
        this.prisma = prisma;
        this.audit = audit;
        this.ws = ws;
        this.shift = shift;
    }
    async setLifecycle(req, body) {
        const riderId = Number(req.user?.id);
        const state = String(body?.state || '').toUpperCase();
        if (!riderId)
            throw new common_1.BadRequestException('Invalid rider');
        if (state !== 'ACTIVE' && state !== 'OFFLINE') {
            throw new common_1.BadRequestException('Invalid state');
        }
        const current = await this.prisma.user.findUnique({
            where: { id: riderId },
            select: { id: true, role: true, status: true },
        });
        if (!current || current.role !== client_1.UserRole.RIDER) {
            throw new common_1.BadRequestException('Rider not found');
        }
        if (current.status === 'SUSPENDED') {
            throw new common_1.ForbiddenException('Account suspended');
        }
        if (current.status === 'PENDING' || current.status === 'REJECTED') {
            throw new common_1.ForbiddenException('Account not approved yet');
        }
        const updated = await this.prisma.user.update({
            where: { id: riderId },
            data: {
                status: state,
                riderAvailability: state === 'ACTIVE' ? 'AVAILABLE' : 'OFFLINE',
            },
            select: { id: true, status: true, riderAvailability: true },
        });
        await this.audit.logAdminAction({
            userId: riderId,
            action: 'RIDER_LIFECYCLE_CHANGED',
            resource: `rider:${riderId}`,
            meta: { from: current.status, to: state },
        });
        this.ws.notifyAdmins('admin_rider_event', {
            riderId,
            status: updated.status,
            riderAvailability: updated.riderAvailability,
            source: 'rider',
        });
        this.ws.notifyUser(riderId, 'user.status', { status: updated.status });
        return { ok: true, status: updated.status };
    }
    async setAvailability(req, body) {
        const riderId = Number(req.user?.id);
        const state = String(body?.state || '').toUpperCase();
        if (!riderId)
            throw new common_1.BadRequestException('Invalid rider');
        if (state !== 'ONLINE' && state !== 'OFFLINE') {
            throw new common_1.BadRequestException('Invalid state');
        }
        const res = await this.shift.setAvailability(riderId, state);
        await this.audit.logAdminAction({
            userId: riderId,
            action: 'RIDER_AVAILABILITY_CHANGED',
            resource: `rider:${riderId}`,
            meta: { state },
        });
        return res;
    }
    async heartbeat(req) {
        const riderId = Number(req.user?.id);
        if (!riderId)
            throw new common_1.BadRequestException('Invalid rider');
        await this.shift.heartbeat(riderId);
        return { ok: true };
    }
    async currentShift(req) {
        const riderId = Number(req.user?.id);
        if (!riderId)
            throw new common_1.BadRequestException('Invalid rider');
        return this.shift.currentShift(riderId);
    }
};
exports.RiderControlController = RiderControlController;
__decorate([
    (0, common_1.Patch)('lifecycle'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RiderControlController.prototype, "setLifecycle", null);
__decorate([
    (0, common_1.Patch)('availability'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RiderControlController.prototype, "setAvailability", null);
__decorate([
    (0, common_1.Patch)('heartbeat'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RiderControlController.prototype, "heartbeat", null);
__decorate([
    (0, common_1.Patch)('shift/current'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RiderControlController.prototype, "currentShift", null);
exports.RiderControlController = RiderControlController = __decorate([
    (0, common_1.Controller)('rider'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.RIDER),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        ws_gateway_1.WsGateway,
        rider_shift_service_1.RiderShiftService])
], RiderControlController);
