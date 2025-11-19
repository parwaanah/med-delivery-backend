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
const rider_dto_1 = require("./dto/rider.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
let RidersController = class RidersController {
    constructor(ridersService) {
        this.ridersService = ridersService;
    }
    findAll() {
        return this.ridersService.findAll();
    }
    findOne(id) {
        return this.ridersService.findOne(Number(id));
    }
    create(dto) {
        return this.ridersService.create(dto);
    }
    update(id, dto) {
        return this.ridersService.update(Number(id), dto);
    }
    updateStatus(id, dto) {
        return this.ridersService.updateStatus(Number(id), dto);
    }
    async updateLocation(id, body) {
        const lat = typeof body.latitude === 'number' ? body.latitude : body.lat;
        const lon = typeof body.longitude === 'number' ? body.longitude : body.lon;
        if (typeof lat !== 'number' || typeof lon !== 'number') {
            throw new common_1.BadRequestException('latitude and longitude (or lat and lon) are required and must be numbers');
        }
        return this.ridersService.updateLocation(Number(id), lat, lon);
    }
    remove(id) {
        return this.ridersService.remove(Number(id));
    }
};
exports.RidersController = RidersController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)('admin'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], RidersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)('admin', 'rider'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RidersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('admin'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [rider_dto_1.CreateRiderDto]),
    __metadata("design:returntype", void 0)
], RidersController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, roles_decorator_1.Roles)('admin', 'rider'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, rider_dto_1.UpdateRiderDto]),
    __metadata("design:returntype", void 0)
], RidersController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, roles_decorator_1.Roles)('admin', 'rider'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, rider_dto_1.UpdateStatusDto]),
    __metadata("design:returntype", void 0)
], RidersController.prototype, "updateStatus", null);
__decorate([
    openapi.ApiOperation({ description: "Update live location.\nAccepts either:\n  { \"latitude\": 19.0, \"longitude\": 72.0 }\nor\n  { \"lat\": 19.0, \"lon\": 72.0 }\n\nNormalizes incoming fields and passes numeric values to service." }),
    (0, common_1.Patch)(':id/location'),
    (0, roles_decorator_1.Roles)('rider', 'admin'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, rider_dto_1.UpdateLocationDto]),
    __metadata("design:returntype", Promise)
], RidersController.prototype, "updateLocation", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)('admin'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RidersController.prototype, "remove", null);
exports.RidersController = RidersController = __decorate([
    (0, common_1.Controller)('riders'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [riders_service_1.RidersService])
], RidersController);
