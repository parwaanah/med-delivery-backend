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
exports.PharmacyInventoryController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const pharmacy_inventory_service_1 = require("./pharmacy-inventory.service");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
let PharmacyInventoryController = class PharmacyInventoryController {
    constructor(svc) {
        this.svc = svc;
    }
    async getPrice(pharmacyId, medicineId, _demand) {
        return this.svc.calculatePrice(Number(pharmacyId), Number(medicineId));
    }
    async getInventory(pharmacyId) {
        return this.svc.listInventory(Number(pharmacyId));
    }
};
exports.PharmacyInventoryController = PharmacyInventoryController;
__decorate([
    (0, common_1.Get)(':pharmacyId/:medicineId/price'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('pharmacyId')),
    __param(1, (0, common_1.Param)('medicineId')),
    __param(2, (0, common_1.Query)('demand')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], PharmacyInventoryController.prototype, "getPrice", null);
__decorate([
    (0, common_1.Get)(':pharmacyId'),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Param)('pharmacyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PharmacyInventoryController.prototype, "getInventory", null);
exports.PharmacyInventoryController = PharmacyInventoryController = __decorate([
    (0, common_1.Controller)('pharmacies/inventory'),
    (0, roles_decorator_1.Roles)('ADMIN', 'PHARMACY'),
    __metadata("design:paramtypes", [pharmacy_inventory_service_1.PharmacyInventoryService])
], PharmacyInventoryController);
