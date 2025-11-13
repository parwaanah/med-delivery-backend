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
var CacheService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const common_1 = require("@nestjs/common");
const lru_cache_1 = require("lru-cache");
let CacheService = CacheService_1 = class CacheService {
    constructor() {
        this.logger = new common_1.Logger(CacheService_1.name);
        this.cache = new lru_cache_1.LRUCache({
            max: 10_000,
            ttl: 1000 * 60 * 30,
            allowStale: false,
        });
        this.logger.log('✅ LRU Cache initialized (v10+ compatible)');
    }
    set(key, value, ttlMs) {
        if (ttlMs && ttlMs > 0) {
            this.cache.set(key, value, { ttl: ttlMs });
        }
        else {
            this.cache.set(key, value);
        }
    }
    get(key, opts) {
        const v = this.cache.get(key);
        if (v && opts?.refreshTTL) {
            this.cache.set(key, v, { ttl: opts.refreshTTL });
        }
        return v;
    }
    del(key) {
        this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
    }
    has(key) {
        return this.cache.has(key);
    }
    size() {
        return this.cache.size;
    }
    dumpStats() {
        return {
            size: this.cache.size,
            max: this.cache.max ?? null,
        };
    }
    onModuleDestroy() {
        this.logger.log('🧹 Clearing cache on shutdown');
        this.clear();
    }
};
exports.CacheService = CacheService;
exports.CacheService = CacheService = CacheService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], CacheService);
