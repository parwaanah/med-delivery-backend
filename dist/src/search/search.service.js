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
exports.SearchService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
let SearchService = class SearchService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async search(query) {
        if (!query || query.trim().length < 2)
            return [];
        const meds = await this.prisma.medicine.findMany({
            where: {
                name: { contains: query, mode: "insensitive" },
            },
            include: {
                inventory: {
                    where: {
                        pharmacy: { role: "PHARMACY" },
                    },
                    include: {
                        pharmacy: {
                            select: {
                                id: true,
                                name: true,
                                latitude: true,
                                longitude: true,
                            },
                        },
                    },
                },
            },
        });
        return meds.map((m) => {
            const inv = m.inventory?.[0];
            return {
                id: m.id,
                name: m.name,
                category: m.category,
                rxType: m.rxType,
                price: inv ? inv.sellingPrice : 0,
                stock: inv ? inv.stock : 0,
                pharmacy: inv ? inv.pharmacy : null,
            };
        });
    }
};
exports.SearchService = SearchService;
exports.SearchService = SearchService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SearchService);
