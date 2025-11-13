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
exports.SessionController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const swagger_1 = require("@nestjs/swagger");
let SessionController = class SessionController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getUserSessions(userId) {
        return this.prisma.session.findMany({
            where: { userId: Number(userId), revoked: false },
            select: { id: true, ip: true, userAgent: true, createdAt: true, expiresAt: true },
        });
    }
    async revokeSession(sessionId) {
        await this.prisma.session.update({
            where: { id: sessionId },
            data: { revoked: true },
        });
        await this.prisma.refreshToken.updateMany({
            where: { sessionId },
            data: { revoked: true },
        });
        return { message: `Session ${sessionId} revoked` };
    }
};
exports.SessionController = SessionController;
__decorate([
    (0, common_1.Get)(':userId'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "getUserSessions", null);
__decorate([
    (0, common_1.Post)('revoke'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "revokeSession", null);
exports.SessionController = SessionController = __decorate([
    (0, swagger_1.ApiTags)('Sessions'),
    (0, common_1.Controller)('sessions'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SessionController);
