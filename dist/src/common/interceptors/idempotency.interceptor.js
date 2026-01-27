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
exports.IdempotencyInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const redis_service_1 = require("../../utils/redis.service");
let IdempotencyInterceptor = class IdempotencyInterceptor {
    constructor(redis) {
        this.redis = redis;
    }
    intercept(context, next) {
        const http = context.switchToHttp();
        const req = http.getRequest();
        const res = http.getResponse();
        const method = String(req.method || '').toUpperCase();
        if (method === 'GET' || method === 'HEAD') {
            return next.handle();
        }
        const key = req.header?.('Idempotency-Key') || req.headers?.['idempotency-key'];
        if (!key)
            return next.handle();
        const userId = req?.user?.id != null ? String(req.user.id) : req.ip ? String(req.ip) : 'anon';
        const routeKey = `idem:${userId}:${method}:${req.originalUrl}:${String(key)}`;
        const ttlSec = Number(process.env.IDEMPOTENCY_TTL_SEC || 24 * 60 * 60);
        return (0, rxjs_1.from)(this.redis.client.get(routeKey)).pipe((0, operators_1.mergeMap)((hit) => {
            if (hit) {
                try {
                    const parsed = JSON.parse(hit);
                    if (parsed?.statusCode)
                        res.status(parsed.statusCode);
                    return (0, rxjs_1.of)(parsed.body);
                }
                catch {
                }
            }
            return next.handle().pipe((0, operators_1.tap)({
                next: async (body) => {
                    const stored = {
                        statusCode: res?.statusCode ?? 200,
                        body,
                        at: new Date().toISOString(),
                    };
                    try {
                        await this.redis.client.set(routeKey, JSON.stringify(stored), {
                            EX: Math.max(60, Math.floor(ttlSec)),
                        });
                    }
                    catch {
                    }
                },
            }));
        }));
    }
};
exports.IdempotencyInterceptor = IdempotencyInterceptor;
exports.IdempotencyInterceptor = IdempotencyInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], IdempotencyInterceptor);
