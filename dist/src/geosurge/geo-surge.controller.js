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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeoSurgeController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const geo_surge_service_1 = require("./geo-surge.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
let GeoSurgeController = class GeoSurgeController {
    constructor(geoSurgeService) {
        this.geoSurgeService = geoSurgeService;
    }
    async getZones() {
        const zones = await this.geoSurgeService.recalcAndBroadcast();
        return {
            count: zones.length,
            zones,
            timestamp: new Date().toISOString(),
        };
    }
};
exports.GeoSurgeController = GeoSurgeController;
__decorate([
    (0, common_1.Get)('status'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], GeoSurgeController.prototype, "getZones", null);
exports.GeoSurgeController = GeoSurgeController = __decorate([
    (0, common_1.Controller)('admin/geo-surge'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __metadata("design:paramtypes", [geo_surge_service_1.GeoSurgeService])
], GeoSurgeController);
