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
exports.AdminOrdersController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const orders_service_1 = require("../orders/orders.service");
const geo_surge_service_1 = require("../geosurge/geo-surge.service");
let AdminOrdersController = class AdminOrdersController {
    constructor(prisma, ordersService, geo) {
        this.prisma = prisma;
        this.ordersService = ordersService;
        this.geo = geo;
    }
    async getCandidateRiders(id) {
        const orderId = Number(id);
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { pharmacy: true },
        });
        if (!order)
            return { total: 0, candidates: [] };
        const lat = order.pharmacy?.latitude;
        const lon = order.pharmacy?.longitude;
        if (!lat || !lon)
            return { total: 0, candidates: [] };
        const rawPoints = await this.geo.findNearbyPoints(lon, lat, 5, true, 50);
        const riders = rawPoints.filter((p) => /^rider:\d+$/.test(p.memberId));
        const scored = [];
        for (const rp of riders) {
            const score = await this.ordersService.getRiderScorePublic(rp, lat, lon);
            scored.push({ ...rp, score });
        }
        scored.sort((a, b) => b.score - a.score);
        return { total: scored.length, candidates: scored };
    }
};
exports.AdminOrdersController = AdminOrdersController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    (0, common_1.Get)(':id/riders'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminOrdersController.prototype, "getCandidateRiders", null);
exports.AdminOrdersController = AdminOrdersController = __decorate([
    (0, common_1.Controller)('admin/orders'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        orders_service_1.OrdersService,
        geo_surge_service_1.GeoSurgeService])
], AdminOrdersController);
