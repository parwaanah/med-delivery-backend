"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const redis_1 = require("redis");
let RedisService = class RedisService {
    async onModuleInit() {
        const url = process.env.REDIS_URL ||
            `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || '6379'}`;
        this.client = (0, redis_1.createClient)({ url });
        this.client.on('error', (err) => {
            console.error('❌ Redis Client Error:', err);
        });
        await this.client.connect();
        console.log(`✅ RedisService connected → ${url}`);
    }
    async onModuleDestroy() {
        try {
            await this.client.quit();
        }
        catch { }
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = __decorate([
    (0, common_1.Injectable)()
], RedisService);
