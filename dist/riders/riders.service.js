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
var RidersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RidersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const geo_surge_service_1 = require("../geosurge/geo-surge.service");
const rider_live_gateway_1 = require("../ws/rider-live.gateway");
let RidersService = RidersService_1 = class RidersService {
    constructor(prisma, geoSurge, riderGateway) {
        this.prisma = prisma;
        this.geoSurge = geoSurge;
        this.riderGateway = riderGateway;
        this.logger = new common_1.Logger(RidersService_1.name);
    }
    async findAll() {
        return this.prisma.user.findMany({
            where: { role: 'RIDER' },
            select: {
                id: true,
                name: true,
                email: true,
                status: true,
                latitude: true,
                longitude: true,
                createdAt: true,
            },
        });
    }
    async findOne(id) {
        const rider = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                status: true,
                latitude: true,
                longitude: true,
                createdAt: true,
            },
        });
        if (!rider)
            throw new common_1.NotFoundException('Rider not found');
        return rider;
    }
    async create(dto) {
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existing)
            throw new common_1.ForbiddenException('Email already in use');
        const rider = await this.prisma.user.create({
            data: {
                name: dto.name,
                email: dto.email,
                password: dto.password,
                role: 'RIDER',
                status: 'AVAILABLE',
                latitude: dto.latitude ?? 28.61,
                longitude: dto.longitude ?? 77.20,
            },
            select: {
                id: true,
                name: true,
                email: true,
                status: true,
                latitude: true,
                longitude: true,
            },
        });
        try {
            await this.geoSurge.addPoint(`rider:${rider.id}`, rider.longitude ?? 77.2, rider.latitude ?? 28.61);
        }
        catch (err) {
            this.logger.warn(`GeoSurge addPoint failed for rider:${rider.id}`);
        }
        return rider;
    }
    async update(id, dto) {
        const rider = await this.prisma.user.findUnique({ where: { id } });
        if (!rider)
            throw new common_1.NotFoundException('Rider not found');
        const updated = await this.prisma.user.update({
            where: { id },
            data: {
                name: dto.name ?? rider.name,
                email: dto.email ?? rider.email,
                latitude: dto.latitude ?? rider.latitude,
                longitude: dto.longitude ?? rider.longitude,
            },
            select: {
                id: true,
                name: true,
                email: true,
                status: true,
                latitude: true,
                longitude: true,
            },
        });
        try {
            if (updated.latitude && updated.longitude) {
                await this.geoSurge.addPoint(`rider:${id}`, updated.longitude, updated.latitude);
            }
        }
        catch (err) {
            this.logger.warn(`GeoSurge updatePoint failed for rider:${id}`);
        }
        return updated;
    }
    async updateStatus(id, dto) {
        const rider = await this.prisma.user.findUnique({ where: { id } });
        if (!rider)
            throw new common_1.NotFoundException('Rider not found');
        const updated = await this.prisma.user.update({
            where: { id },
            data: { status: dto.status },
            select: { id: true, name: true, email: true, status: true },
        });
        try {
            if (dto.status === 'AVAILABLE') {
                const lat = rider.latitude ?? 28.61;
                const lon = rider.longitude ?? 77.2;
                await this.geoSurge.addPoint(`rider:${rider.id}`, lon, lat);
            }
            else {
                await this.geoSurge.removePoint(`rider:${rider.id}`);
            }
        }
        catch (err) {
            this.logger.warn('GeoSurge rider status sync failed', err);
        }
        return updated;
    }
    async remove(id) {
        const rider = await this.prisma.user.findUnique({ where: { id } });
        if (!rider)
            throw new common_1.NotFoundException('Rider not found');
        await this.prisma.user.delete({ where: { id } });
        try {
            await this.geoSurge.removePoint(`rider:${id}`);
        }
        catch { }
        return { message: 'Rider deleted successfully' };
    }
    async updateLocation(id, lat, lon) {
        const rider = await this.prisma.user.findUnique({ where: { id } });
        if (!rider)
            throw new common_1.NotFoundException('Rider not found');
        await this.prisma.user.update({
            where: { id },
            data: { latitude: lat, longitude: lon },
        });
        try {
            await this.geoSurge.addPoint(`rider:${id}`, lon, lat);
        }
        catch (err) {
            this.logger.warn(`GeoSurge addPoint failed for rider:${id}`, err);
        }
        this.riderGateway.notifyAdmins('rider_location', {
            id,
            lat,
            lon,
            status: rider.status,
            timestamp: Date.now(),
        });
        return { ok: true, id, lat, lon };
    }
};
exports.RidersService = RidersService;
exports.RidersService = RidersService = RidersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        geo_surge_service_1.GeoSurgeService,
        rider_live_gateway_1.RiderLiveGateway])
], RidersService);
