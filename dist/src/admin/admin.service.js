"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
let AdminService = class AdminService {
    async createPharmacy(name, address, phone) {
        if (!name || !address || !phone) {
            throw new common_1.BadRequestException('Name, address, and phone are required');
        }
        return await prisma.pharmacy.create({
            data: { name, address, phone },
        });
    }
    async addMedicine(pharmacyId, name, price, stock) {
        const pharmacy = await prisma.pharmacy.findUnique({ where: { id: pharmacyId } });
        if (!pharmacy)
            throw new common_1.NotFoundException('Pharmacy not found');
        return await prisma.medicine.create({
            data: { name, price, stock, pharmacyId },
        });
    }
    async updateMedicineStock(medicineId, stock) {
        const medicine = await prisma.medicine.findUnique({ where: { id: medicineId } });
        if (!medicine)
            throw new common_1.NotFoundException('Medicine not found');
        return await prisma.medicine.update({
            where: { id: medicineId },
            data: { stock },
        });
    }
    async getAllOrders() {
        return await prisma.order.findMany({
            include: {
                user: true,
                pharmacy: true,
                items: { include: { medicine: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async updateOrderStatus(orderId, status) {
        const validStatuses = [
            'pending',
            'accepted',
            'picked_up',
            'delivered',
            'cancelled',
        ];
        if (!validStatuses.includes(status)) {
            throw new common_1.BadRequestException(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        return await prisma.order.update({
            where: { id: orderId },
            data: { status: status },
            include: {
                user: true,
                pharmacy: true,
                items: { include: { medicine: true } },
            },
        });
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)()
], AdminService);
//# sourceMappingURL=admin.service.js.map