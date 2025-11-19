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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var GeoSurgeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeoSurgeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
const geo_surge_live_gateway_1 = require("../ws/geo-surge-live.gateway");
let GeoSurgeService = GeoSurgeService_1 = class GeoSurgeService {
    constructor(config, gateway) {
        this.config = config;
        this.gateway = gateway;
        this.logger = new common_1.Logger(GeoSurgeService_1.name);
        this.GEO_KEY = 'geosurge:riders';
        this.redisUrl = this.config.get('REDIS_URL') || 'redis://127.0.0.1:6379';
        this.initRedis();
    }
    initRedis() {
        try {
            this.redis = new ioredis_1.default(this.redisUrl);
            this.redis.on('connect', () => this.logger.log(`✅ GeoSurge connected → ${this.redisUrl}`));
            this.redis.on('error', (err) => this.logger.warn('Redis error:', err?.message ?? JSON.stringify(err)));
        }
        catch (err) {
            this.logger.error('Failed to init Redis for GeoSurge', err?.message ?? JSON.stringify(err));
        }
    }
    async addPoint(id, lon, lat, meta = {}) {
        try {
            await this.redis.geoadd(this.GEO_KEY, lon, lat, id);
            await this.redis.hset(`geo:meta:${id}`, 'lon', String(lon), 'lat', String(lat), 'meta', JSON.stringify(meta));
        }
        catch (err) {
            this.logger.warn(`addPoint failed for ${id}`, err?.message ?? JSON.stringify(err));
        }
    }
    async removePoint(id) {
        try {
            await this.redis.zrem(this.GEO_KEY, id);
            await this.redis.del(`geo:meta:${id}`);
        }
        catch (err) {
            this.logger.warn('removePoint failed', err?.message ?? JSON.stringify(err));
        }
    }
    async findNearbyPoints(lon, lat, km = 5, includeMeta = true, limit = 50) {
        try {
            const raw = await this.redis.geosearch(this.GEO_KEY, 'FROMLONLAT', lon, lat, 'BYRADIUS', km, 'km', 'WITHDIST', 'COUNT', limit, 'ASC');
            if (!raw || raw.length === 0)
                return [];
            const items = [];
            for (const entry of raw) {
                const memberId = entry[0];
                const distKm = parseFloat(entry[1]);
                let meta = {};
                if (includeMeta) {
                    const h = await this.redis.hgetall(`geo:meta:${memberId}`);
                    if (h.meta)
                        meta = JSON.parse(h.meta);
                }
                items.push({
                    memberId,
                    distKm,
                    meta,
                });
            }
            return items;
        }
        catch (err) {
            this.logger.warn('findNearbyPoints failed', err?.message ?? JSON.stringify(err));
            return [];
        }
    }
    broadcastGeo(zones) {
        try {
            if (this.gateway)
                this.gateway.broadcastGeo(zones);
        }
        catch (_) { }
    }
};
exports.GeoSurgeService = GeoSurgeService;
exports.GeoSurgeService = GeoSurgeService = GeoSurgeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [config_1.ConfigService,
        geo_surge_live_gateway_1.GeoSurgeLiveGateway])
], GeoSurgeService);
