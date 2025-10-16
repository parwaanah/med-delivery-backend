"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RidersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
let RidersService = class RidersService {
    async createRider(name, phone, vehicleNumber, password = 'rider123') {
        if (!name || !phone || !vehicleNumber) {
            throw new common_1.BadRequestException('Name, phone, and vehicle number are required');
        }
        const existingUser = await prisma.user.findFirst({ where: { email: `${phone}@rider.com` } });
        if (existingUser) {
            throw new common_1.BadRequestException('Rider already exists for this phone number');
        }
        const hashed = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                name,
                email: `${phone}@rider.com`,
                password: hashed,
                role: 'rider',
            },
        });
        return prisma.rider.create({
            data: {
                name,
                phone,
                vehicleNumber,
                userId: user.id,
            },
        });
    }
    async getAllRiders() {
        return prisma.rider.findMany({
            include: { user: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async updateRider(id, data) {
        const rider = await prisma.rider.findUnique({ where: { id } });
        if (!rider)
            throw new common_1.NotFoundException('Rider not found');
        return prisma.rider.update({
            where: { id },
            data,
        });
    }
    async deleteRider(id) {
        const rider = await prisma.rider.findUnique({ where: { id } });
        if (!rider)
            throw new common_1.NotFoundException('Rider not found');
        await prisma.user.delete({ where: { id: rider.userId } });
        return prisma.rider.delete({ where: { id } });
    }
};
exports.RidersService = RidersService;
exports.RidersService = RidersService = __decorate([
    (0, common_1.Injectable)()
], RidersService);
//# sourceMappingURL=riders.service.js.map