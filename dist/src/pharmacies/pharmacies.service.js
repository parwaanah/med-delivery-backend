"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PharmaciesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
let PharmaciesService = class PharmaciesService {
    async findAll() {
        return prisma.pharmacy.findMany({ include: { medicines: true } });
    }
    async findOne(id) {
        return prisma.pharmacy.findUnique({ where: { id }, include: { medicines: true } });
    }
    async create(data) {
        return prisma.pharmacy.create({ data });
    }
    async addMedicine(pharmacyId, medicineData) {
        return prisma.medicine.create({ data: { ...medicineData, pharmacyId } });
    }
};
exports.PharmaciesService = PharmaciesService;
exports.PharmaciesService = PharmaciesService = __decorate([
    (0, common_1.Injectable)()
], PharmaciesService);
//# sourceMappingURL=pharmacies.service.js.map