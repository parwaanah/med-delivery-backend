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
exports.AnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const roles_decorator_1 = require("../../auth/roles.decorator");
const roles_guard_1 = require("../../auth/roles.guard");
const jwt_auth_guard_1 = require("../../auth/jwt-auth.guard");
const analytics_service_1 = require("./analytics.service");
let AnalyticsController = class AnalyticsController {
    analyticsService;
    constructor(analyticsService) {
        this.analyticsService = analyticsService;
    }
    async getSummary() {
        return await this.analyticsService.getSummary();
    }
    async getOrderTrends() {
        return await this.analyticsService.getOrderTrends();
    }
    async getTopPharmacies() {
        return await this.analyticsService.getTopPharmacies();
    }
};
exports.AnalyticsController = AnalyticsController;
__decorate([
    (0, common_1.Get)('summary'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Get)('orders-trend'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getOrderTrends", null);
__decorate([
    (0, common_1.Get)('top-pharmacies'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getTopPharmacies", null);
exports.AnalyticsController = AnalyticsController = __decorate([
    (0, common_1.Controller)('admin/analytics'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __metadata("design:paramtypes", [analytics_service_1.AnalyticsService])
], AnalyticsController);
//# sourceMappingURL=analytics.controller.js.map