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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeoSurgeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
const geo_surge_live_gateway_1 = require("../ws/geo-surge-live.gateway");
let GeoSurgeService = class GeoSurgeService {
    constructor(config, gateway) {
        this.config = config;
        this.gateway = gateway;
        this.logger = new common_1.Logger('GeoSurgeService');
        this.key = 'geo:points';
        this.calcIntervalMs = 15 * 1000;
    }
    onModuleInit() {
        const url = this.config.get('REDIS_URL') ?? 'redis://127.0.0.1:6379';
        this.redis = new ioredis_1.default(url);
        this.logger.log(`✅ GeoSurge connected to Redis → ${url}`);
        this.interval = setInterval(() => this.recalcAndBroadcast().catch(err => this.logger.error('recalc err', err)), this.calcIntervalMs);
    }
    onModuleDestroy() {
        if (this.interval)
            clearInterval(this.interval);
        try {
            this.redis.disconnect();
        }
        catch { }
    }
    async addPoint(memberId, lon, lat) {
        await this.redis.geoadd(this.key, lon, lat, memberId);
        await this.redis.hset(`geo:meta:${memberId}`, { lon: String(lon), lat: String(lat), updated: String(Date.now()) });
    }
    async removePoint(memberId) {
        await this.redis.zrem(this.key, memberId);
        await this.redis.del(`geo:meta:${memberId}`);
    }
    async recalcAndBroadcast() {
        try {
            const raw = await this.redis.zrange(this.key, 0, -1);
            if (!raw || raw.length === 0) {
                this.gateway.broadcastGeo([]);
                return [];
            }
            const members = raw;
            const coords = await Promise.all(members.map(m => this.redis.geopos(this.key, m)));
            const points = members.map((m, i) => {
                const p = coords[i]?.[0];
                return p ? { id: m, lon: parseFloat(p[0]), lat: parseFloat(p[1]) } : null;
            }).filter(Boolean);
            const buckets = new Map();
            for (const pt of points) {
                const key = `${pt.lon.toFixed(3)}:${pt.lat.toFixed(3)}`;
                if (!buckets.has(key))
                    buckets.set(key, { lon: pt.lon, lat: pt.lat, members: [] });
                buckets.get(key).members.push(pt.id);
            }
            const zones = [];
            for (const [k, v] of buckets) {
                const radiusKm = 0.3;
                const nearby = await this.redis.georadius(this.key, v.lon, v.lat, radiusKm, 'km');
                const count = nearby?.length ?? v.members.length;
                const multiplier = Number((1 + Math.min(2, count / 8)).toFixed(2));
                zones.push({
                    id: k,
                    lon: v.lon,
                    lat: v.lat,
                    count,
                    multiplier,
                    lastUpdated: Date.now(),
                });
            }
            zones.sort((a, b) => b.multiplier - a.multiplier);
            const top = zones.slice(0, 200);
            this.gateway.broadcastGeo(top);
            this.logger.log(`🔺 GeoSurge broadcast ${top.length} zones`);
            return top;
        }
        catch (err) {
            this.logger.error('recalcAndBroadcast error', err);
            return [];
        }
    }
};
exports.GeoSurgeService = GeoSurgeService;
exports.GeoSurgeService = GeoSurgeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService, geo_surge_live_gateway_1.GeoSurgeLiveGateway])
], GeoSurgeService);
