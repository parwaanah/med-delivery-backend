"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicinesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
let MedicinesService = class MedicinesService {
    async getMedicines(pharmacyId) {
        const where = pharmacyId ? { pharmacyId } : {};
        return prisma.medicine.findMany({ where });
    }
    async getMedicinesByPharmacy(pharmacyId) {
        return this.getMedicines(pharmacyId);
    }
    async getAllMedicines() {
        return this.getMedicines();
    }
    async createMedicine(name, price, stock, pharmacyId) {
        const pharmacy = await prisma.pharmacy.findUnique({ where: { id: pharmacyId } });
        if (!pharmacy)
            throw new common_1.BadRequestException('Pharmacy not found');
        return prisma.medicine.create({
            data: { name, price, stock, pharmacyId },
        });
    }
    async updateMedicine(id, data) {
        const med = await prisma.medicine.findUnique({ where: { id } });
        if (!med)
            throw new common_1.BadRequestException('Medicine not found');
        return prisma.medicine.update({ where: { id }, data });
    }
    async deleteMedicine(id) {
        const med = await prisma.medicine.findUnique({ where: { id } });
        if (!med)
            throw new common_1.BadRequestException('Medicine not found');
        return prisma.medicine.delete({ where: { id } });
    }
};
exports.MedicinesService = MedicinesService;
exports.MedicinesService = MedicinesService = __decorate([
    (0, common_1.Injectable)()
], MedicinesService);
//# sourceMappingURL=medicines.service.js.map