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
exports.LockService = void 0;
const common_1 = require("@nestjs/common");
const redis_service_1 = require("./redis.service");
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
let LockService = class LockService {
    constructor(redis) {
        this.redis = redis;
    }
    token() {
        return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random()
            .toString(16)
            .slice(2)}`;
    }
    async acquire(key, ttlMs) {
        const token = this.token();
        const ok = await this.redis.client.set(key, token, {
            NX: true,
            PX: Math.max(1, Math.floor(ttlMs)),
        });
        return ok ? token : null;
    }
    async release(key, token) {
        const lua = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end`;
        try {
            await this.redis.client.eval(lua, {
                keys: [key],
                arguments: [token],
            });
        }
        catch {
        }
    }
    async withLock(key, ttlMs, fn, opts) {
        const waitMs = Math.max(0, Math.floor(opts?.waitMs ?? 50));
        const retries = Math.max(0, Math.floor(opts?.retries ?? 20));
        let token = null;
        for (let i = 0; i <= retries; i++) {
            token = await this.acquire(key, ttlMs);
            if (token)
                break;
            if (i < retries)
                await sleep(waitMs);
        }
        if (!token) {
            throw new Error(`LOCK_BUSY:${key}`);
        }
        try {
            return await fn();
        }
        finally {
            await this.release(key, token);
        }
    }
};
exports.LockService = LockService;
exports.LockService = LockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], LockService);
