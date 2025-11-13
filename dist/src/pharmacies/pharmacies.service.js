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
exports.PharmaciesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
let PharmaciesService = class PharmaciesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        return this.prisma.user.findMany({
            where: { role: 'PHARMACY' },
            select: { id: true, name: true, email: true, createdAt: true },
        });
    }
    async findOne(id) {
        const pharmacy = await this.prisma.user.findUnique({
            where: { id },
            select: { id: true, name: true, email: true, createdAt: true },
        });
        if (!pharmacy)
            throw new common_1.NotFoundException('Pharmacy not found');
        return pharmacy;
    }
    async create(dto) {
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existing)
            throw new common_1.ForbiddenException('Email already in use');
        return this.prisma.user.create({
            data: {
                name: dto.name,
                email: dto.email,
                password: dto.password,
                role: 'PHARMACY',
            },
            select: { id: true, name: true, email: true, role: true },
        });
    }
    async update(id, dto) {
        const pharmacy = await this.prisma.user.findUnique({ where: { id } });
        if (!pharmacy)
            throw new common_1.NotFoundException('Pharmacy not found');
        return this.prisma.user.update({
            where: { id },
            data: { name: dto.name ?? pharmacy.name, email: dto.email ?? pharmacy.email },
            select: { id: true, name: true, email: true, role: true },
        });
    }
    async remove(id) {
        const pharmacy = await this.prisma.user.findUnique({ where: { id } });
        if (!pharmacy)
            throw new common_1.NotFoundException('Pharmacy not found');
        await this.prisma.user.delete({ where: { id } });
        return { message: 'Pharmacy deleted successfully' };
    }
};
exports.PharmaciesService = PharmaciesService;
exports.PharmaciesService = PharmaciesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PharmaciesService);
