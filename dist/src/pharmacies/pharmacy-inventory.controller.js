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
exports.PharmacyInventoryController = exports.PharmaciesInventoryController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const pharmacy_inventory_service_1 = require("./pharmacy-inventory.service");
const create_inventory_dto_1 = require("./dto/create-inventory.dto");
const update_inventory_dto_1 = require("./dto/update-inventory.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const approval_guard_1 = require("../common/guards/approval.guard");
const prisma_service_1 = require("../utils/prisma.service");
const client_1 = require("@prisma/client");
let PharmaciesInventoryController = class PharmaciesInventoryController {
    constructor(svc) {
        this.svc = svc;
    }
    async addInventory(req, id, dto) {
        const pharmacyId = Number(id);
        if ((req.user?.role ?? '').toUpperCase() === 'PHARMACY' && Number(req.user?.id) !== pharmacyId) {
            throw new common_1.NotFoundException('Not authorized to add inventory for this pharmacy');
        }
        return this.svc.add(pharmacyId, dto);
    }
    updateInventory(req, id, invId, dto) {
        const pharmacyId = Number(id);
        if ((req.user?.role ?? '').toUpperCase() === 'PHARMACY' && Number(req.user?.id) !== pharmacyId) {
            throw new common_1.NotFoundException('Not authorized');
        }
        return this.svc.update(Number(invId), dto);
    }
    removeInventory(req, id, invId) {
        const pharmacyId = Number(id);
        if ((req.user?.role ?? '').toUpperCase() === 'PHARMACY' && Number(req.user?.id) !== pharmacyId) {
            throw new common_1.NotFoundException('Not authorized');
        }
        return this.svc.remove(Number(invId));
    }
    listInventory(id) {
        return this.svc.listInventory(Number(id));
    }
};
exports.PharmaciesInventoryController = PharmaciesInventoryController;
__decorate([
    (0, common_1.Post)(':id/inventory/add'),
    (0, roles_decorator_1.Roles)('pharmacy', 'admin'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, create_inventory_dto_1.CreateInventoryDto]),
    __metadata("design:returntype", Promise)
], PharmaciesInventoryController.prototype, "addInventory", null);
__decorate([
    (0, common_1.Patch)(':id/inventory/:invId'),
    (0, roles_decorator_1.Roles)('pharmacy', 'admin'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('invId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, update_inventory_dto_1.UpdateInventoryDto]),
    __metadata("design:returntype", void 0)
], PharmaciesInventoryController.prototype, "updateInventory", null);
__decorate([
    (0, common_1.Delete)(':id/inventory/:invId'),
    (0, roles_decorator_1.Roles)('pharmacy', 'admin'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('invId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], PharmaciesInventoryController.prototype, "removeInventory", null);
__decorate([
    (0, common_1.Get)(':id/inventory'),
    (0, roles_decorator_1.Roles)('pharmacy', 'admin'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PharmaciesInventoryController.prototype, "listInventory", null);
exports.PharmaciesInventoryController = PharmaciesInventoryController = __decorate([
    (0, common_1.Controller)('pharmacies'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, approval_guard_1.ApprovalGuard),
    __metadata("design:paramtypes", [pharmacy_inventory_service_1.PharmacyInventoryService])
], PharmaciesInventoryController);
let PharmacyInventoryController = class PharmacyInventoryController {
    constructor(svc, prisma) {
        this.svc = svc;
        this.prisma = prisma;
    }
    async list(req) {
        const pharmacyId = Number(req.user?.id);
        return this.prisma.pharmacyInventory.findMany({
            where: { pharmacyId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            include: {
                medicine: {
                    select: {
                        id: true,
                        name: true,
                        rxType: true,
                        category: true,
                    },
                },
            },
        });
    }
    async add(req, dto) {
        const pharmacyId = Number(req.user?.id);
        const created = await this.svc.add(pharmacyId, dto);
        return this.prisma.pharmacyInventory.findUnique({
            where: { id: created.id },
            include: {
                medicine: {
                    select: { id: true, name: true, rxType: true, category: true },
                },
            },
        });
    }
    async update(req, id, dto) {
        const pharmacyId = Number(req.user?.id);
        const inventoryId = Number(id);
        const rec = await this.prisma.pharmacyInventory.findUnique({
            where: { id: inventoryId },
            select: { id: true, pharmacyId: true },
        });
        if (!rec || rec.deletedAt)
            throw new common_1.NotFoundException('Inventory record not found');
        if (rec.pharmacyId !== pharmacyId) {
            throw new common_1.ForbiddenException('Not authorized');
        }
        await this.svc.update(inventoryId, dto);
        return this.prisma.pharmacyInventory.findUnique({
            where: { id: inventoryId },
            include: {
                medicine: {
                    select: { id: true, name: true, rxType: true, category: true },
                },
            },
        });
    }
    async remove(req, id) {
        const pharmacyId = Number(req.user?.id);
        const inventoryId = Number(id);
        const rec = await this.prisma.pharmacyInventory.findUnique({
            where: { id: inventoryId },
            select: { id: true, pharmacyId: true },
        });
        if (!rec || rec.deletedAt)
            throw new common_1.NotFoundException('Inventory record not found');
        if (rec.pharmacyId !== pharmacyId) {
            throw new common_1.ForbiddenException('Not authorized');
        }
        return this.svc.remove(inventoryId);
    }
};
exports.PharmacyInventoryController = PharmacyInventoryController;
__decorate([
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PharmacyInventoryController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_inventory_dto_1.CreateInventoryDto]),
    __metadata("design:returntype", Promise)
], PharmacyInventoryController.prototype, "add", null);
__decorate([
    (0, common_1.Patch)(':id'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_inventory_dto_1.UpdateInventoryDto]),
    __metadata("design:returntype", Promise)
], PharmacyInventoryController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PharmacyInventoryController.prototype, "remove", null);
exports.PharmacyInventoryController = PharmacyInventoryController = __decorate([
    (0, common_1.Controller)('pharmacy/inventory'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, approval_guard_1.ApprovalGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.PHARMACY),
    __metadata("design:paramtypes", [pharmacy_inventory_service_1.PharmacyInventoryService,
        prisma_service_1.PrismaService])
], PharmacyInventoryController);
