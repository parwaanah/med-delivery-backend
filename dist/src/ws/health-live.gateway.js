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
exports.HealthLiveGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const prisma_service_1 = require("../utils/prisma.service");
const redis_logger_1 = require("../utils/redis-logger");
const config_1 = require("@nestjs/config");
let HealthLiveGateway = class HealthLiveGateway {
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
        this.redisUrl = this.config.get('REDIS_URL') || 'redis://127.0.0.1:6379';
    }
    afterInit() {
        console.log('⚡ HealthLiveGateway initialized');
        this.startBroadcastLoop();
    }
    async startBroadcastLoop() {
        const delay = (ms) => new Promise((res) => setTimeout(res, ms));
        while (true) {
            try {
                const report = await this.checkSystemHealth();
                this.server.emit('health_update', report);
            }
            catch (err) {
                console.error('💀 Health broadcast failed:', err);
            }
            await delay(10_000);
        }
    }
    async checkSystemHealth() {
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
        return results;
    }
};
exports.HealthLiveGateway = HealthLiveGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], HealthLiveGateway.prototype, "server", void 0);
exports.HealthLiveGateway = HealthLiveGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: true, namespace: '/health-live' }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], HealthLiveGateway);
