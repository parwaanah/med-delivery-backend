"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggingThrottlerGuard = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const core_1 = require("@nestjs/core");
const winston = __importStar(require("winston"));
require("winston-daily-rotate-file");
let LoggingThrottlerGuard = class LoggingThrottlerGuard extends throttler_1.ThrottlerGuard {
    storageService;
    reflector;
    logger;
    constructor(options, storageService, reflector) {
        super(options, storageService, reflector);
        this.storageService = storageService;
        this.reflector = reflector;
        const fs = require('fs');
        if (!fs.existsSync('logs')) {
            fs.mkdirSync('logs');
        }
        const transport = new winston.transports.DailyRotateFile({
            dirname: 'logs',
            filename: 'throttler-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '10m',
            maxFiles: '14d',
            level: 'warn',
        });
        this.logger = winston.createLogger({
            level: 'warn',
            format: winston.format.combine(winston.format.timestamp(), winston.format.printf(({ timestamp, level, message }) => {
                return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
            })),
            transports: [new winston.transports.Console(), transport],
        });
    }
    async throwThrottlingException(context, throttlerLimitDetail) {
        const request = context.switchToHttp().getRequest();
        const ip = request.ip || request.headers['x-forwarded-for'] || 'unknown';
        const path = request.url;
        const user = request.user?.email || request.user?.id || 'anonymous';
        const ttlSeconds = typeof throttlerLimitDetail.ttl === 'number'
            ? throttlerLimitDetail.ttl / 1000
            : throttlerLimitDetail.ttl;
        const message = `⚠️ Throttle limit exceeded | User: ${user} | IP: ${ip} | Route: ${path} | Limit: ${throttlerLimitDetail.limit} | TTL: ${ttlSeconds}s`;
        this.logger.warn(message);
        await super.throwThrottlingException(context, throttlerLimitDetail);
    }
};
exports.LoggingThrottlerGuard = LoggingThrottlerGuard;
exports.LoggingThrottlerGuard = LoggingThrottlerGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, throttler_1.InjectThrottlerOptions)()),
    __metadata("design:paramtypes", [Object, Object, core_1.Reflector])
], LoggingThrottlerGuard);
//# sourceMappingURL=logging-throttler.guard.js.map