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
exports.RiderQualityController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const approval_guard_1 = require("../common/guards/approval.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const rider_quality_service_1 = require("./rider-quality.service");
let RiderQualityController = class RiderQualityController {
    constructor(quality) {
        this.quality = quality;
    }
    summary(req) {
        return this.quality.summary(Number(req.user?.id));
    }
};
exports.RiderQualityController = RiderQualityController;
__decorate([
    (0, common_1.Get)('summary'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RiderQualityController.prototype, "summary", null);
exports.RiderQualityController = RiderQualityController = __decorate([
    (0, common_1.Controller)('rider/quality'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, approval_guard_1.ApprovalGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.RIDER),
    __metadata("design:paramtypes", [rider_quality_service_1.RiderQualityService])
], RiderQualityController);
