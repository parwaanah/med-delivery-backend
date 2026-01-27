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
exports.RidersController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const riders_service_1 = require("./riders.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const approval_guard_1 = require("../common/guards/approval.guard");
const client_1 = require("@prisma/client");
let RidersController = class RidersController {
    constructor(riders) {
        this.riders = riders;
    }
    async updateLocation(req, id, body) {
        if (!body.lat || !body.lon)
            throw new common_1.BadRequestException('lat & lon required');
        if (Number(req.user?.id) !== Number(id)) {
            throw new common_1.ForbiddenException('Cannot update another rider');
        }
        return this.riders.updateLocation(Number(id), body.lat, body.lon);
    }
    async updateStatus(req, id, body) {
        if (Number(req.user?.id) !== Number(id)) {
            throw new common_1.ForbiddenException('Cannot update another rider');
        }
        return this.riders.updateStatus(Number(id), body.status);
    }
};
exports.RidersController = RidersController;
__decorate([
    (0, common_1.Patch)(':id/location'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], RidersController.prototype, "updateLocation", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], RidersController.prototype, "updateStatus", null);
exports.RidersController = RidersController = __decorate([
    (0, common_1.Controller)('riders'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, approval_guard_1.ApprovalGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.RIDER),
    __metadata("design:paramtypes", [riders_service_1.RidersService])
], RidersController);
