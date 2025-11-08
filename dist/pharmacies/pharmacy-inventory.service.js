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
            where: { pharmacyId },
            include: { medicine: true },
        });
    }
    async getMedicinePrice(pharmacyId, medicineId) {
        const rec = await this.prisma.pharmacyInventory.findUnique({
            where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
        });
        if (!rec)
            throw new common_1.NotFoundException('Medicine not found in inventory');
        return { price: rec.price, stock: rec.stock };
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
        if (!rec)
            throw new common_1.NotFoundException('inventory record not found');
        const stock = Math.max(0, rec.stock + delta);
        return this.prisma.pharmacyInventory.update({
            where: { id: rec.id },
            data: { stock },
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
