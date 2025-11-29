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
exports.PharmaciesController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const pharmacies_service_1 = require("./pharmacies.service");
const pharmacy_dto_1 = require("./dto/pharmacy.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
let PharmaciesController = class PharmaciesController {
    constructor(pharmaciesService) {
        this.pharmaciesService = pharmaciesService;
    }
    findAll() {
        return this.pharmaciesService.findAll();
    }
    findOne(id) {
        return this.pharmaciesService.findOne(Number(id));
    }
    create(dto) {
        return this.pharmaciesService.create(dto);
    }
    update(id, dto) {
        return this.pharmaciesService.update(Number(id), dto);
    }
    remove(id) {
        return this.pharmaciesService.remove(Number(id));
    }
    async updateLocation(id, lat, lon) {
        if (!lat || !lon) {
            throw new common_1.HttpException('lat & lon required', common_1.HttpStatus.BAD_REQUEST);
        }
        return this.pharmaciesService.updateLocation(Number(id), lat, lon);
    }
};
exports.PharmaciesController = PharmaciesController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)('admin'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PharmaciesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)('admin', 'pharmacy'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PharmaciesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('admin'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pharmacy_dto_1.CreatePharmacyDto]),
    __metadata("design:returntype", void 0)
], PharmaciesController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, roles_decorator_1.Roles)('admin', 'pharmacy'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, pharmacy_dto_1.UpdatePharmacyDto]),
    __metadata("design:returntype", void 0)
], PharmaciesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)('admin'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PharmaciesController.prototype, "remove", null);
__decorate([
    (0, common_1.Patch)(':id/location'),
    (0, roles_decorator_1.Roles)('admin', 'pharmacy'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('lat')),
    __param(2, (0, common_1.Body)('lon')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Number]),
    __metadata("design:returntype", Promise)
], PharmaciesController.prototype, "updateLocation", null);
exports.PharmaciesController = PharmaciesController = __decorate([
    (0, common_1.Controller)('pharmacies'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [pharmacies_service_1.PharmaciesService])
], PharmaciesController);
