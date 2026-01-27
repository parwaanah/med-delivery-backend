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
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const ws_gateway_1 = require("../ws/ws.gateway");
const notification_service_1 = require("../utils/notification.service");
const audit_service_1 = require("../utils/audit.service");
let AdminUsersController = class AdminUsersController {
    constructor(prisma, ws, notify, audit) {
        this.prisma = prisma;
        this.ws = ws;
        this.notify = notify;
        this.audit = audit;
    }
    profileSummary(profile) {
        const data = profile?.data || {};
        return {
            pharmacyName: data?.pharmacyName ?? null,
            ownerName: data?.ownerName ?? null,
            city: data?.address?.city ?? null,
            pin: data?.address?.pin ?? null,
            drugLicenseNumber: data?.drugLicenseNumber ?? null,
            gstNumber: data?.gstNumber ?? null,
            openingHours: data?.openingHours ?? null,
        };
    }
    docCounts(docs) {
        const total = docs.length;
        const verified = docs.filter((d) => d.verified).length;
        return { total, verified, pending: total - verified };
    }
    async list(q, role, status) {
        const where = {};
        if (q) {
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
            ];
        }
        if (role && Object.values(client_1.UserRole).includes(role)) {
            where.role = role;
        }
        if (status) {
            where.status = status;
        }
        const users = await this.prisma.user.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: { partnerProfile: true, verificationDocs: true },
        });
        const items = users.map((u) => ({
            ...u,
            partnerProfile: u.partnerProfile
                ? this.profileSummary(u.partnerProfile)
                : null,
            docCounts: this.docCounts(u.verificationDocs || []),
            verificationDocs: undefined,
        }));
        return { users: items };
    }
    async pending(role) {
        if (!Object.values(client_1.UserRole).includes(role)) {
            throw new common_1.BadRequestException('Invalid role');
        }
        const users = await this.prisma.user.findMany({
            where: { role: role, status: 'PENDING' },
            include: { verificationDocs: true, partnerProfile: true },
            orderBy: { createdAt: 'asc' },
        });
        const items = users.map((u) => ({
            ...u,
            partnerProfile: u.partnerProfile
                ? this.profileSummary(u.partnerProfile)
                : null,
            docCounts: this.docCounts(u.verificationDocs || []),
            verificationDocs: undefined,
        }));
        return { users: items };
    }
    async approve(id, req) {
        const userId = Number(id);
        const before = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, status: true, role: true },
        });
        await this.prisma.user.update({
            where: { id: userId },
            data: before?.role === client_1.UserRole.RIDER
                ? { status: 'ACTIVE', riderAvailability: 'AVAILABLE' }
                : { status: 'APPROVED' },
        });
        this.ws.notifyUser(userId, 'user.approved', {
            status: before?.role === client_1.UserRole.RIDER ? 'ACTIVE' : 'APPROVED',
        });
        await this.notify.create(userId, 'ACCOUNT_APPROVED', 'Your account has been approved by admin', { status: before?.role === client_1.UserRole.RIDER ? 'ACTIVE' : 'APPROVED' }, req.user?.id);
        await this.audit.logAdminAction({
            userId: req.user?.id,
            action: 'USER_APPROVED',
            resource: `user:${userId}`,
            meta: { from: before?.status, to: 'APPROVED', role: before?.role },
        });
        return { success: true };
    }
    async documents(id) {
        const userId = Number(id);
        if (isNaN(userId))
            throw new common_1.BadRequestException('Invalid user');
        return this.prisma.verificationDocument.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async verifyDoc(id, docId, req) {
        const userId = Number(id);
        const documentId = Number(docId);
        await this.prisma.verificationDocument.update({
            where: { id: documentId },
            data: { verified: true },
        });
        this.ws.notifyUser(userId, 'doc.verified', {
            id: documentId,
            verified: true,
        });
        await this.notify.create(userId, 'DOC_VERIFIED', 'A document was verified by admin', { docId: documentId, verified: true }, req.user?.id);
        const remaining = await this.prisma.verificationDocument.count({
            where: { userId, verified: false },
        });
        if (remaining === 0) {
            await this.prisma.user.update({
                where: { id: userId },
                data: { status: 'APPROVED' },
            });
            this.ws.notifyUser(userId, 'user.approved', { status: 'APPROVED' });
            await this.notify.create(userId, 'ACCOUNT_APPROVED', 'All documents verified. Your account has been approved.', { status: 'APPROVED' }, req.user?.id);
        }
        return { success: true };
    }
    async rejectDoc(id, docId, req) {
        const userId = Number(id);
        const documentId = Number(docId);
        await this.prisma.verificationDocument.delete({
            where: { id: documentId },
        });
        this.ws.notifyUser(userId, 'doc.rejected', {
            id: documentId,
            rejected: true,
        });
        await this.notify.create(userId, 'DOC_REJECTED', 'A document was rejected by admin', { docId: documentId, rejected: true }, req.user?.id);
        return { success: true };
    }
    async reject(id, req) {
        const userId = Number(id);
        const before = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, status: true, role: true },
        });
        await this.prisma.user.update({
            where: { id: userId },
            data: { status: 'REJECTED' },
        });
        this.ws.notifyUser(userId, 'user.rejected', { status: 'REJECTED' });
        await this.notify.create(userId, 'ACCOUNT_REJECTED', 'Your account was rejected by admin', { status: 'REJECTED' }, req.user?.id);
        await this.audit.logAdminAction({
            userId: req.user?.id,
            action: 'USER_REJECTED',
            resource: `user:${userId}`,
            meta: { from: before?.status, to: 'REJECTED', role: before?.role },
        });
        return { success: true };
    }
    async overrideStatus(id, req, value) {
        const userId = Number(id);
        if (!value)
            throw new common_1.BadRequestException('Status value required');
        const before = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, status: true, role: true },
        });
        await this.prisma.user.update({
            where: { id: userId },
            data: { status: value },
        });
        this.ws.notifyUser(userId, 'user.status', { status: value });
        await this.notify.create(userId, 'ACCOUNT_STATUS_CHANGED', `Your account status is now ${value}`, { status: value }, req.user?.id);
        await this.audit.logAdminAction({
            userId: req.user?.id,
            action: 'USER_STATUS_OVERRIDE',
            resource: `user:${userId}`,
            meta: { from: before?.status, to: value, role: before?.role },
        });
        return { success: true };
    }
    async messageUser(id, body, req) {
        const userId = Number(id);
        if (isNaN(userId))
            throw new common_1.BadRequestException('Invalid user');
        const message = String(body?.message || '').trim();
        if (!message)
            throw new common_1.BadRequestException('Message is required');
        await this.notify.create(userId, 'ADMIN_MESSAGE', message, { from: 'ADMIN' }, req.user?.id);
        await this.audit.logAdminAction({
            userId: req.user?.id,
            action: 'ADMIN_MESSAGE_SENT',
            resource: `user:${userId}`,
            meta: { message },
        });
        return { success: true };
    }
    async suspendRider(id, body, req) {
        const userId = Number(id);
        if (isNaN(userId))
            throw new common_1.BadRequestException('Invalid user');
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true, status: true },
        });
        if (!user || user.role !== client_1.UserRole.RIDER) {
            throw new common_1.BadRequestException('Rider not found');
        }
        const code = String(body?.code || '').toUpperCase();
        if (!['FRAUD', 'INACTIVITY', 'COMPLIANCE'].includes(code)) {
            throw new common_1.BadRequestException('Invalid reason code');
        }
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                status: 'SUSPENDED',
                riderAvailability: 'OFFLINE',
                riderReasonCode: code,
                riderReasonNote: body?.note ? String(body.note).trim() : null,
            },
        });
        this.ws.notifyUser(userId, 'user.status', { status: 'SUSPENDED' });
        await this.notify.create(userId, 'ACCOUNT_SUSPENDED', `Your rider account was suspended (${code}). Contact support.`, { status: 'SUSPENDED', code, note: body?.note }, req.user?.id);
        await this.audit.logAdminAction({
            userId: req.user?.id,
            action: 'RIDER_SUSPENDED',
            resource: `rider:${userId}`,
            meta: { from: user.status, to: 'SUSPENDED', code, note: body?.note },
        });
        return { success: true };
    }
    async resumeRider(id, body, req) {
        const userId = Number(id);
        if (isNaN(userId))
            throw new common_1.BadRequestException('Invalid user');
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true, status: true },
        });
        if (!user || user.role !== client_1.UserRole.RIDER) {
            throw new common_1.BadRequestException('Rider not found');
        }
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                status: 'ACTIVE',
                riderAvailability: 'AVAILABLE',
                riderReasonCode: null,
                riderReasonNote: null,
            },
        });
        this.ws.notifyUser(userId, 'user.status', { status: 'ACTIVE' });
        await this.notify.create(userId, 'ACCOUNT_RESTORED', 'Your rider account is active again.', { status: 'ACTIVE', note: body?.note }, req.user?.id);
        await this.audit.logAdminAction({
            userId: req.user?.id,
            action: 'RIDER_RESUMED',
            resource: `rider:${userId}`,
            meta: { from: user.status, to: 'ACTIVE', note: body?.note },
        });
        return { success: true };
    }
    async remove(id) {
        const userId = Number(id);
        if (isNaN(userId))
            throw new common_1.BadRequestException('Invalid user');
        await this.prisma.user.delete({ where: { id: userId } });
        return { success: true };
    }
};
exports.AdminUsersController = AdminUsersController;
__decorate([
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('role')),
    __param(2, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('pending/:role'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('role')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "pending", null);
__decorate([
    (0, common_1.Patch)(':id/approve'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "approve", null);
__decorate([
    (0, common_1.Get)(':id/documents'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "documents", null);
__decorate([
    (0, common_1.Patch)(':id/documents/:docId/verify'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('docId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "verifyDoc", null);
__decorate([
    (0, common_1.Patch)(':id/documents/:docId/reject'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('docId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "rejectDoc", null);
__decorate([
    (0, common_1.Patch)(':id/reject'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "reject", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Query)('value')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "overrideStatus", null);
__decorate([
    (0, common_1.Post)(':id/message'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "messageUser", null);
__decorate([
    (0, common_1.Patch)(':id/rider/suspend'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "suspendRider", null);
__decorate([
    (0, common_1.Patch)(':id/rider/resume'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "resumeRider", null);
__decorate([
    (0, common_1.Delete)(':id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "remove", null);
exports.AdminUsersController = AdminUsersController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    (0, common_1.Controller)('admin/users'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ws_gateway_1.WsGateway,
        notification_service_1.NotificationService,
        audit_service_1.AuditService])
], AdminUsersController);
