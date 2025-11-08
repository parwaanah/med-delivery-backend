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
exports.AdminUsersController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
let AdminUsersController = class AdminUsersController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getPendingUsers() {
        const pending = await this.prisma.user.findMany({
            where: { status: 'PENDING' },
            select: { id: true, name: true, email: true, role: true, status: true },
        });
        return { total: pending.length, users: pending };
    }
    async approveUser(id) {
        return this.prisma.user.update({
            where: { id: Number(id) },
            data: { status: 'APPROVED' },
        });
    }
    async rejectUser(id) {
        return this.prisma.user.update({
            where: { id: Number(id) },
            data: { status: 'REJECTED' },
        });
    }
};
exports.AdminUsersController = AdminUsersController;
__decorate([
    (0, common_1.Get)('pending'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "getPendingUsers", null);
__decorate([
    (0, common_1.Patch)(':id/approve'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "approveUser", null);
__decorate([
    (0, common_1.Patch)(':id/reject'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "rejectUser", null);
exports.AdminUsersController = AdminUsersController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.Controller)('admin/users'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminUsersController);
