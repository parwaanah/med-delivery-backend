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
exports.SurgeService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const config_1 = require("@nestjs/config");
const surge_live_gateway_1 = require("../ws/surge-live.gateway");
const ioredis_1 = __importDefault(require("ioredis"));
let SurgeService = class SurgeService {
    constructor(prisma, config, surgeGateway) {
        this.prisma = prisma;
        this.config = config;
        this.surgeGateway = surgeGateway;
        this.logger = new common_1.Logger('SurgeService');
        this.windowMs = 15 * 60 * 1000;
        this.baseMultiplier = 1.0;
        this.currentMultiplier = 1.0;
        this.overrideValue = null;
        this.historyKey = 'surge:history';
        this.demandKey = 'surge:demand';
        this.supplyKey = 'surge:supply';
        const url = this.config.get('REDIS_URL') ?? 'redis://127.0.0.1:6379';
        this.redis = new ioredis_1.default(url, { maxRetriesPerRequest: null, enableReadyCheck: true });
        this.logger.log(`✅ Predictive Surge Engine connected → ${url}`);
        (async () => {
            const keys = [this.historyKey, this.demandKey, this.supplyKey];
            for (const key of keys) {
                try {
                    const type = await this.redis.type(key);
                    if (key === this.historyKey && type !== 'zset' && type !== 'none') {
                        this.logger.warn(`🧹 Resetting old Redis key: ${key} (was ${type})`);
                        await this.redis.del(key);
                    }
                    if ((key === this.demandKey || key === this.supplyKey) && type !== 'string' && type !== 'none') {
                        this.logger.warn(`🧹 Resetting old Redis key: ${key} (was ${type})`);
                        await this.redis.del(key);
                    }
                }
                catch (err) {
                    this.logger.error(`Redis cleanup failed for ${key}`, err);
                }
            }
        })();
    }
    async incrementDemand(by = 1) {
        await this.redis.incrby(this.demandKey, by);
        return this.recalculate();
    }
    async recordRiderAvailability(riderId, available) {
        await this.redis.incrby(this.supplyKey, available ? 1 : -1);
        return this.recalculate();
    }
    async recalculate() {
        try {
            if (this.overrideValue)
                return this.broadcast(this.overrideValue);
            const demand = parseInt((await this.redis.get(this.demandKey)) || '0', 10);
            const supply = Math.max(1, parseInt((await this.redis.get(this.supplyKey)) || '1', 10));
            const snap = {
                timestamp: Date.now(),
                demand,
                supply,
                multiplier: this.currentMultiplier,
            };
            try {
                await this.redis.zadd(this.historyKey, Date.now(), JSON.stringify(snap));
            }
            catch (err) {
                if (err?.message?.includes('WRONGTYPE')) {
                    this.logger.warn(`⚠️ Surge history type mismatch — resetting key '${this.historyKey}'`);
                    await this.redis.del(this.historyKey);
                    await this.redis.zadd(this.historyKey, Date.now(), JSON.stringify(snap));
                }
                else {
                    throw err;
                }
            }
            await this.trimHistory();
            const minScore = Date.now() - this.windowMs;
            const samples = await this.redis.zrangebyscore(this.historyKey, minScore, '+inf');
            const parsed = samples.map((s) => JSON.parse(s));
            const avgDemand = parsed.length > 0 ? parsed.reduce((a, b) => a + b.demand, 0) / parsed.length : demand;
            const avgSupply = parsed.length > 0 ? parsed.reduce((a, b) => a + b.supply, 0) / parsed.length : supply;
            const ratio = avgDemand / avgSupply;
            const smoothFactor = 0.6;
            const targetMult = this.baseMultiplier + Math.max(0, ratio - 1) * 0.75;
            this.currentMultiplier =
                this.currentMultiplier * smoothFactor + targetMult * (1 - smoothFactor);
            this.currentMultiplier = Number(this.currentMultiplier.toFixed(2));
            return this.broadcast(this.currentMultiplier, demand, supply);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error('❌ Surge recalc failed', message);
            return { multiplier: this.currentMultiplier, error: message };
        }
    }
    async trimHistory() {
        const cutoff = Date.now() - this.windowMs;
        await this.redis.zremrangebyscore(this.historyKey, '-inf', cutoff);
    }
    broadcast(multiplier, demand = 0, supply = 0) {
        this.surgeGateway.broadcastSurge({
            multiplier,
            demand,
            supply,
            timestamp: Date.now(),
        });
        this.logger.log(`⚡ Surge update → x${multiplier} (demand ${demand}, supply ${supply})`);
        return { multiplier, demand, supply };
    }
    async overrideMultiplier(multiplier, meta) {
        this.overrideValue = multiplier;
        this.logger.warn(`🛠 Surge override → x${multiplier} by ${meta?.setBy ?? 'manual'}`);
        return this.broadcast(multiplier);
    }
    async clearOverride() {
        this.overrideValue = null;
        this.logger.log('🔄 Surge override cleared; resuming predictive mode');
        return this.recalculate();
    }
    async getStatus() {
        const demand = parseInt((await this.redis.get(this.demandKey)) || '0', 10);
        const supply = parseInt((await this.redis.get(this.supplyKey)) || '0', 10);
        return {
            multiplier: this.overrideValue ?? this.currentMultiplier,
            demand,
            supply,
            override: this.overrideValue,
        };
    }
};
exports.SurgeService = SurgeService;
exports.SurgeService = SurgeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        surge_live_gateway_1.SurgeLiveGateway])
], SurgeService);
