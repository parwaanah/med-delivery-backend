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
exports.PharmacyInventoryService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../utils/prisma.service");
const surge_service_1 = require("../surge/surge.service");
const notification_service_1 = require("../utils/notification.service");
let PharmacyInventoryService = class PharmacyInventoryService {
    constructor(prisma, surge, notify) {
        this.prisma = prisma;
        this.surge = surge;
        this.notify = notify;
    }
    async listInventory(pharmacyId) {
        return this.prisma.pharmacyInventory.findMany({
            where: { pharmacyId, deletedAt: null },
            include: { medicine: true },
        });
    }
    async add(pharmacyId, dto) {
        const { medicineId, mrp, sellingPrice, discount = 0, stock = 0 } = dto;
        if (!medicineId)
            throw new common_1.BadRequestException('medicineId required');
        if (mrp == null || sellingPrice == null) {
            throw new common_1.BadRequestException('mrp and sellingPrice required');
        }
        const mrpDec = new client_1.Prisma.Decimal(mrp);
        const sellingDec = new client_1.Prisma.Decimal(sellingPrice);
        return this.prisma.pharmacyInventory.upsert({
            where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
            update: {
                mrp: mrpDec,
                sellingPrice: sellingDec,
                discount,
                stock,
                deletedAt: null,
            },
            create: {
                pharmacyId,
                medicineId,
                mrp: mrpDec,
                sellingPrice: sellingDec,
                discount,
                stock,
                deletedAt: null,
            },
        });
    }
    async update(inventoryId, dto) {
        const rec = await this.prisma.pharmacyInventory.findUnique({
            where: { id: inventoryId },
        });
        if (!rec || rec.deletedAt)
            throw new common_1.NotFoundException('Inventory record not found');
        const mrp = dto.mrp != null ? new client_1.Prisma.Decimal(dto.mrp) : rec.mrp;
        const sellingPrice = dto.sellingPrice != null
            ? new client_1.Prisma.Decimal(dto.sellingPrice)
            : rec.sellingPrice;
        return this.prisma.pharmacyInventory.update({
            where: { id: inventoryId },
            data: {
                mrp,
                sellingPrice,
                discount: dto.discount ?? rec.discount,
                stock: dto.stock ?? rec.stock,
            },
        });
    }
    async remove(inventoryId) {
        const rec = await this.prisma.pharmacyInventory.findUnique({
            where: { id: inventoryId },
        });
        if (!rec || rec.deletedAt)
            throw new common_1.NotFoundException('Inventory not found');
        await this.prisma.pharmacyInventory.update({
            where: { id: inventoryId },
            data: { deletedAt: new Date(), stock: 0 },
        });
        return { ok: true, deletedId: inventoryId, softDeleted: true };
    }
    async getMedicinePrice(pharmacyId, medicineId) {
        const rec = await this.prisma.pharmacyInventory.findUnique({
            where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
        });
        if (!rec || rec.deletedAt)
            throw new common_1.NotFoundException('Medicine not found in inventory');
        return { price: Number(rec.sellingPrice), stock: rec.stock };
    }
    async calculatePrice(pharmacyId, medicineId) {
        const base = await this.getMedicinePrice(pharmacyId, medicineId);
        const { multiplier } = await this.surge.getStatus();
        const price = Number((base.price * multiplier).toFixed(2));
        return { price, basePrice: base.price, multiplier };
    }
    async updateStock(pharmacyId, medicineId, delta) {
        if (!Number.isFinite(delta))
            throw new common_1.BadRequestException('delta required');
        const rec = await this.prisma.pharmacyInventory.findUnique({
            where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
        });
        if (!rec || rec.deletedAt)
            throw new common_1.NotFoundException('inventory record not found');
        const newStock = Math.max(0, rec.stock + delta);
        return this.prisma.pharmacyInventory.update({
            where: { id: rec.id },
            data: { stock: newStock },
        });
    }
};
exports.PharmacyInventoryService = PharmacyInventoryService;
exports.PharmacyInventoryService = PharmacyInventoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        surge_service_1.SurgeService,
        notification_service_1.NotificationService])
], PharmacyInventoryService);
