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
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const admin_service_1 = require("./admin.service");
const passport_1 = require("@nestjs/passport");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const create_pharmacy_dto_1 = require("./dto/create-pharmacy.dto");
const add_medicine_dto_1 = require("./dto/add-medicine.dto");
const update_stock_dto_1 = require("./dto/update-stock.dto");
const update_status_dto_1 = require("./dto/update-status.dto");
let AdminController = class AdminController {
    adminService;
    constructor(adminService) {
        this.adminService = adminService;
    }
    async createPharmacy(dto) {
        return this.adminService.createPharmacy(dto.name, dto.address, dto.phone);
    }
    async addMedicine(dto) {
        return this.adminService.addMedicine(dto.pharmacyId, dto.name, dto.price, dto.stock);
    }
    async updateStock(id, dto) {
        return this.adminService.updateMedicineStock(Number(id), dto.stock);
    }
    async getAllOrders() {
        return this.adminService.getAllOrders();
    }
    async updateOrderStatus(id, dto) {
        return this.adminService.updateOrderStatus(Number(id), dto.status);
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Post)('pharmacy'),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_pharmacy_dto_1.CreatePharmacyDto]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "createPharmacy", null);
__decorate([
    (0, common_1.Post)('medicine'),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [add_medicine_dto_1.AddMedicineDto]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "addMedicine", null);
__decorate([
    (0, common_1.Patch)('medicine/:id/stock'),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_stock_dto_1.UpdateStockDto]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateStock", null);
__decorate([
    (0, common_1.Get)('orders'),
    (0, roles_decorator_1.Roles)('admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getAllOrders", null);
__decorate([
    (0, common_1.Patch)('orders/:id/status'),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_status_dto_1.UpdateStatusDto]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateOrderStatus", null);
exports.AdminController = AdminController = __decorate([
    (0, common_1.Controller)('admin'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt'), roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map