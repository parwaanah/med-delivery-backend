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
exports.HealthController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const redis_logger_1 = require("../utils/redis-logger");
const config_1 = require("@nestjs/config");
let HealthController = class HealthController {
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
    }
    async getHealth() {
        const redisUrl = this.config.get('REDIS_URL') || 'redis://127.0.0.1:6379';
        const results = {
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        };
        try {
            await this.prisma.$queryRaw `SELECT 1;`;
            results.database = { status: 'up' };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : JSON.stringify(err) || 'Unknown error';
            results.database = { status: 'down', error: msg };
        }
        try {
            await (0, redis_logger_1.redisPing)();
            results.redis = { status: 'up' };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : JSON.stringify(err) || 'Unknown error';
            results.redis = { status: 'down', error: msg };
        }
        const mem = process.memoryUsage();
        results.memory = {
            rss: mem.rss,
            heapTotal: mem.heapTotal,
            heapUsed: mem.heapUsed,
        };
        const anyDown = Object.values(results).some((v) => v && v.status === 'down');
        if (anyDown) {
            throw new common_1.HttpException({ status: 'error', details: results }, common_1.HttpStatus.SERVICE_UNAVAILABLE);
        }
        return { status: 'ok', details: results };
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "getHealth", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], HealthController);
