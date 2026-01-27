"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UtilsModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("./prisma.service");
const notification_service_1 = require("./notification.service");
const audit_service_1 = require("./audit.service");
const jwt_blacklist_service_1 = require("./jwt-blacklist.service");
const redis_service_1 = require("./redis.service");
const lock_service_1 = require("./lock.service");
const ws_module_1 = require("../ws/ws.module");
let UtilsModule = class UtilsModule {
};
exports.UtilsModule = UtilsModule;
exports.UtilsModule = UtilsModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [ws_module_1.WsModule],
        providers: [
            prisma_service_1.PrismaService,
            notification_service_1.NotificationService,
            audit_service_1.AuditService,
            jwt_blacklist_service_1.JwtBlacklistService,
            redis_service_1.RedisService,
            lock_service_1.LockService,
        ],
        exports: [
            prisma_service_1.PrismaService,
            notification_service_1.NotificationService,
            audit_service_1.AuditService,
            jwt_blacklist_service_1.JwtBlacklistService,
            redis_service_1.RedisService,
            lock_service_1.LockService,
        ],
    })
], UtilsModule);
