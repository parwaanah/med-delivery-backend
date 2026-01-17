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
exports.MedicinesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
let MedicinesService = class MedicinesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async searchMedicines(query) {
        const q = (query || '').trim();
        if (!q)
            return [];
        const medicines = await this.prisma.medicine.findMany({
            where: {
                name: { contains: q, mode: 'insensitive' },
            },
            take: 50,
            orderBy: { id: 'asc' },
        });
        const enriched = await Promise.all(medicines.map(async (m) => {
            const inv = await this.prisma.pharmacyInventory.findFirst({
                where: { medicineId: m.id, stock: { gt: 0 } },
                include: {
                    pharmacy: { select: { id: true, name: true } },
                },
            });
            if (!inv)
                return null;
            return {
                ...m,
                stock: inv.stock,
                price: Number(inv.sellingPrice),
                mrp: Number(inv.mrp),
                discount: Number(inv.discount || 0),
                pharmacy: inv.pharmacy.name,
                pharmacyId: inv.pharmacy.id,
            };
        }));
        return enriched.filter(Boolean);
    }
    async getFeaturedMedicines() {
        const medicines = await this.prisma.medicine.findMany({
            take: 16,
            orderBy: { createdAt: 'desc' },
        });
        const enriched = await Promise.all(medicines.map(async (m) => {
            const inv = await this.prisma.pharmacyInventory.findFirst({
                where: { medicineId: m.id, stock: { gt: 0 } },
                include: {
                    pharmacy: { select: { id: true, name: true } },
                },
            });
            if (!inv)
                return null;
            return {
                ...m,
                stock: inv.stock,
                price: Number(inv.sellingPrice),
                mrp: Number(inv.mrp),
                discount: Number(inv.discount || 0),
                pharmacy: inv.pharmacy.name,
                pharmacyId: inv.pharmacy.id,
            };
        }));
        return enriched.filter(Boolean);
    }
    async getMedicineById(id) {
        const m = await this.prisma.medicine.findUnique({
            where: { id },
        });
        if (!m)
            return null;
        const inv = await this.prisma.pharmacyInventory.findFirst({
            where: { medicineId: m.id, stock: { gt: 0 } },
            include: {
                pharmacy: { select: { id: true, name: true } },
            },
        });
        if (!inv)
            return null;
        return {
            ...m,
            stock: inv.stock,
            price: Number(inv.sellingPrice),
            mrp: Number(inv.mrp),
            discount: Number(inv.discount || 0),
            pharmacy: inv.pharmacy.name,
            pharmacyId: inv.pharmacy.id,
        };
    }
};
exports.MedicinesService = MedicinesService;
exports.MedicinesService = MedicinesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MedicinesService);
