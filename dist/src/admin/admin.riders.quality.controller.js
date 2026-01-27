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
exports.AdminRiderQualityController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const rider_quality_service_1 = require("../riders/rider-quality.service");
let AdminRiderQualityController = class AdminRiderQualityController {
    constructor(quality) {
        this.quality = quality;
    }
    async qualitySummary(id) {
        const riderId = Number(id);
        if (isNaN(riderId))
            throw new common_1.BadRequestException('Invalid rider id');
        return this.quality.summary(riderId);
    }
    async addStrike(id, body) {
        const riderId = Number(id);
        if (isNaN(riderId))
            throw new common_1.BadRequestException('Invalid rider id');
        if (!body?.type)
            throw new common_1.BadRequestException('type required');
        return this.quality.addStrike({
            riderId,
            type: body.type,
            points: body.points ?? 1,
            reason: body.reason,
            meta: body.meta,
        });
    }
};
exports.AdminRiderQualityController = AdminRiderQualityController;
__decorate([
    (0, common_1.Get)(':id/quality'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminRiderQualityController.prototype, "qualitySummary", null);
__decorate([
    (0, common_1.Post)(':id/strikes'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminRiderQualityController.prototype, "addStrike", null);
exports.AdminRiderQualityController = AdminRiderQualityController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    (0, common_1.Controller)('admin/riders'),
    __metadata("design:paramtypes", [rider_quality_service_1.RiderQualityService])
], AdminRiderQualityController);
