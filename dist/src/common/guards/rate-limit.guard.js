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
exports.RateLimitGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const cache_service_1 = require("../../cache/cache.service");
const rate_limit_decorator_1 = require("../decorators/rate-limit.decorator");
let RateLimitGuard = class RateLimitGuard {
    constructor(reflector, cache) {
        this.reflector = reflector;
        this.cache = cache;
    }
    canActivate(context) {
        const opts = this.reflector.getAllAndOverride(rate_limit_decorator_1.RATE_LIMIT_META_KEY, [context.getHandler(), context.getClass()]);
        if (!opts)
            return true;
        const req = context.switchToHttp().getRequest();
        const subject = req?.user?.id ? `u:${req.user.id}` : `ip:${req.ip}`;
        const key = `rl:${opts.key}:${subject}`;
        const now = Date.now();
        const existing = this.cache.get(key);
        if (!existing || now >= existing.expiresAt) {
            this.cache.set(key, { count: 1, expiresAt: now + opts.windowMs }, opts.windowMs);
            return true;
        }
        if (existing.count >= opts.limit) {
            const retryAfterSec = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
            throw new common_1.HttpException(`Too many requests. Retry after ${retryAfterSec}s`, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        const next = { ...existing, count: existing.count + 1 };
        this.cache.set(key, next, Math.max(1, existing.expiresAt - now));
        return true;
    }
};
exports.RateLimitGuard = RateLimitGuard;
exports.RateLimitGuard = RateLimitGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        cache_service_1.CacheService])
], RateLimitGuard);
