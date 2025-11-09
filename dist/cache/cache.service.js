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
var CacheService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("@nestjs/config");
let CacheService = CacheService_1 = class CacheService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(CacheService_1.name);
    }
    onModuleInit() {
        const url = this.config.get('REDIS_URL') || 'redis://127.0.0.1:6379';
        this.client = new ioredis_1.default(url);
        this.client.on('connect', () => this.logger.log(`✅ Redis cache connected ${url}`));
        this.client.on('error', (e) => this.logger.warn('Redis cache error', e));
    }
    async get(key) {
        const v = await this.client.get(key);
        return v ? JSON.parse(v) : null;
    }
    async set(key, value, ttlSec = 60) {
        await this.client.set(key, JSON.stringify(value), 'EX', ttlSec);
    }
    async del(key) {
        await this.client.del(key);
    }
};
exports.CacheService = CacheService;
exports.CacheService = CacheService = CacheService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], CacheService);
