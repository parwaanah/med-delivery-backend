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
exports.ServiceAreaService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
function isFiniteNumber(v) {
    return typeof v === 'number' && Number.isFinite(v);
}
function isLngLatPair(p) {
    return Array.isArray(p) && p.length >= 2 && isFiniteNumber(p[0]) && isFiniteNumber(p[1]);
}
function pointInRing(point, ring) {
    const x = point[0];
    const y = point[1];
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0];
        const yi = ring[i][1];
        const xj = ring[j][0];
        const yj = ring[j][1];
        const intersect = yi > y !== yj > y &&
            x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi;
        if (intersect)
            inside = !inside;
    }
    return inside;
}
function pointInPolygon(point, polygon) {
    const rings = polygon.coordinates;
    if (!rings?.length)
        return false;
    const outer = rings[0];
    if (!pointInRing(point, outer))
        return false;
    for (let i = 1; i < rings.length; i++) {
        if (pointInRing(point, rings[i]))
            return false;
    }
    return true;
}
function validateGeoJSON(geo) {
    if (!geo || typeof geo !== 'object') {
        throw new common_1.BadRequestException('Invalid geojson');
    }
    const t = String(geo.type || '');
    if (t !== 'Polygon' && t !== 'MultiPolygon') {
        throw new common_1.BadRequestException('GeoJSON must be Polygon or MultiPolygon');
    }
    if (t === 'Polygon') {
        const coords = geo.coordinates;
        if (!Array.isArray(coords) || coords.length === 0) {
            throw new common_1.BadRequestException('Polygon coordinates missing');
        }
        for (const ring of coords) {
            if (!Array.isArray(ring) || ring.length < 4) {
                throw new common_1.BadRequestException('Invalid polygon ring');
            }
            for (const p of ring) {
                if (!isLngLatPair(p))
                    throw new common_1.BadRequestException('Invalid coordinate pair');
            }
        }
        return geo;
    }
    const coords = geo.coordinates;
    if (!Array.isArray(coords) || coords.length === 0) {
        throw new common_1.BadRequestException('MultiPolygon coordinates missing');
    }
    for (const poly of coords) {
        if (!Array.isArray(poly) || poly.length === 0) {
            throw new common_1.BadRequestException('Invalid multipolygon');
        }
        for (const ring of poly) {
            if (!Array.isArray(ring) || ring.length < 4) {
                throw new common_1.BadRequestException('Invalid polygon ring');
            }
            for (const p of ring) {
                if (!isLngLatPair(p))
                    throw new common_1.BadRequestException('Invalid coordinate pair');
            }
        }
    }
    return geo;
}
let ServiceAreaService = class ServiceAreaService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listZones() {
        return this.prisma.serviceZone.findMany({
            orderBy: { id: 'desc' },
        });
    }
    async createZone(data) {
        const geojson = validateGeoJSON(data.geojson);
        return this.prisma.serviceZone.create({
            data: {
                name: data.name,
                geojson: geojson,
                active: data.active ?? true,
            },
        });
    }
    async updateZone(id, data) {
        const patch = {};
        if (typeof data.name === 'string')
            patch.name = data.name;
        if (typeof data.active === 'boolean')
            patch.active = data.active;
        if (data.geojson != null)
            patch.geojson = validateGeoJSON(data.geojson);
        return this.prisma.serviceZone.update({
            where: { id },
            data: patch,
        });
    }
    async deleteZone(id) {
        await this.prisma.serviceZone.delete({ where: { id } });
        return { ok: true };
    }
    async isPointServiced(lat, lng) {
        if (!isFiniteNumber(lat) || !isFiniteNumber(lng))
            return false;
        const zones = await this.prisma.serviceZone.findMany({
            where: { active: true },
            select: { geojson: true },
            take: 200,
        });
        const point = [lng, lat];
        for (const z of zones) {
            const geo = z.geojson;
            try {
                const g = validateGeoJSON(geo);
                if (g.type === 'Polygon') {
                    if (pointInPolygon(point, g))
                        return true;
                }
                else {
                    for (const polyCoords of g.coordinates) {
                        const poly = { type: 'Polygon', coordinates: polyCoords };
                        if (pointInPolygon(point, poly))
                            return true;
                    }
                }
            }
            catch {
            }
        }
        return false;
    }
    async assertPointServiced(lat, lng) {
        if (lat == null || lng == null) {
            throw new common_1.BadRequestException('Delivery location not set. Please allow location or set it in your account profile.');
        }
        const ok = await this.isPointServiced(Number(lat), Number(lng));
        if (!ok) {
            throw new common_1.BadRequestException('Sorry, we are not available in your area yet.');
        }
        return true;
    }
};
exports.ServiceAreaService = ServiceAreaService;
exports.ServiceAreaService = ServiceAreaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ServiceAreaService);
