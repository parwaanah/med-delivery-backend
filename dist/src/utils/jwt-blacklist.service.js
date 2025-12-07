"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtBlacklistService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
let JwtBlacklistService = class JwtBlacklistService {
    constructor() {
        this.redis = new ioredis_1.Redis(process.env.REDIS_URL || 'redis://redis:6379');
        this.prefix = 'jwt_blacklist:';
    }
    async revoke(token, exp) {
        const ttl = exp - Math.floor(Date.now() / 1000);
        await this.redis.setex(`${this.prefix}${token}`, ttl, 'revoked');
    }
    async isRevoked(token) {
        return (await this.redis.exists(`${this.prefix}${token}`)) === 1;
    }
};
exports.JwtBlacklistService = JwtBlacklistService;
exports.JwtBlacklistService = JwtBlacklistService = __decorate([
    (0, common_1.Injectable)()
], JwtBlacklistService);
