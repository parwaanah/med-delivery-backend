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
exports.ProfileController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const platform_express_1 = require("@nestjs/platform-express");
const prisma_service_1 = require("../utils/prisma.service");
const cloudinary_service_1 = require("../uploads/cloudinary.service");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
let ProfileController = class ProfileController {
    constructor(prisma, cloud) {
        this.prisma = prisma;
        this.cloud = cloud;
    }
    async getMyProfile(req) {
        return this.prisma.partnerProfile.findUnique({
            where: { userId: req.user.id },
        });
    }
    async saveMyProfile(req, data) {
        return this.prisma.partnerProfile.upsert({
            where: { userId: req.user.id },
            create: {
                userId: req.user.id,
                role: client_1.UserRole.PHARMACY,
                data,
            },
            update: {
                data,
            },
        });
    }
    async uploadDocument(req, file, type) {
        if (!file)
            throw new common_1.BadRequestException('File required');
        if (!type)
            throw new common_1.BadRequestException('Document type required');
        const uploaded = await this.cloud.uploadBuffer(file.buffer, 'verification_docs');
        return this.prisma.verificationDocument.create({
            data: {
                userId: req.user.id,
                url: uploaded.secure_url,
                type,
            },
        });
    }
    async listDocuments(req) {
        return this.prisma.verificationDocument.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
        });
    }
};
exports.ProfileController = ProfileController;
__decorate([
    (0, common_1.Get)('me'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProfileController.prototype, "getMyProfile", null);
__decorate([
    (0, common_1.Post)('me'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProfileController.prototype, "saveMyProfile", null);
__decorate([
    (0, common_1.Post)('documents'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ProfileController.prototype, "uploadDocument", null);
__decorate([
    (0, common_1.Get)('documents'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProfileController.prototype, "listDocuments", null);
exports.ProfileController = ProfileController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.PHARMACY),
    (0, common_1.Controller)('profile'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cloudinary_service_1.CloudinaryService])
], ProfileController);
