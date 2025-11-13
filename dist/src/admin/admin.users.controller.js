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
var AdminUsersController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminUsersController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
let AdminUsersController = AdminUsersController_1 = class AdminUsersController {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(AdminUsersController_1.name);
    }
    async getAllUsers() {
        const users = await this.prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, status: true },
            orderBy: { id: 'desc' },
        });
        return { total: users.length, users };
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
    async deleteUser(id) {
        const userId = Number(id);
        if (isNaN(userId))
            throw new common_1.NotFoundException('Invalid user ID');
        const existing = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true },
        });
        if (!existing)
            throw new common_1.NotFoundException(`User #${userId} not found`);
        try {
            await this.prisma.$transaction([
                this.prisma.refreshToken.deleteMany({ where: { userId } }),
                this.prisma.session.deleteMany({ where: { userId } }),
                this.prisma.user.delete({ where: { id: userId } }),
            ]);
            this.logger.log(`Deleted user #${userId} (${existing.email})`);
            return { message: `User #${userId} deleted successfully` };
        }
        catch (err) {
            this.logger.error(`Failed to delete user #${userId}`, err);
            throw new common_1.InternalServerErrorException('Failed to delete user — see server logs');
        }
    }
};
exports.AdminUsersController = AdminUsersController;
__decorate([
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "getAllUsers", null);
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
__decorate([
    (0, common_1.Delete)(':id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "deleteUser", null);
exports.AdminUsersController = AdminUsersController = AdminUsersController_1 = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN, 'ADMIN', 'admin'),
    (0, common_1.Controller)('admin/users'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminUsersController);
