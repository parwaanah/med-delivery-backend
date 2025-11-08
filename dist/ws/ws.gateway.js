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
var WsGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsModule = exports.WsGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const prisma_service_1 = require("../utils/prisma.service");
let WsGateway = WsGateway_1 = class WsGateway {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(WsGateway_1.name);
    }
    handleConnection(client) {
        this.logger.log(`Socket connected: ${client.id}`);
        client.on('join', (payload) => {
            try {
                const uid = payload?.userId;
                if (!uid)
                    return;
                client.join(`user-${uid}`);
                this.logger.log(`Socket ${client.id} joined room user-${uid}`);
            }
            catch (err) {
                this.logger.warn('join handler error', err);
            }
        });
    }
    handleDisconnect(client) {
        this.logger.log(`Socket disconnected: ${client.id}`);
    }
    notifyUser(userId, event, payload) {
        try {
            if (!this.server)
                return;
            this.server.to(`user-${userId}`).emit(event, payload);
        }
        catch (err) {
            this.logger.warn(`Failed to notify user ${userId}`, err);
        }
    }
    broadcast(event, payload) {
        try {
            if (!this.server)
                return;
            this.server.emit(event, payload);
        }
        catch (err) {
            this.logger.warn('Broadcast failed', err);
        }
    }
};
exports.WsGateway = WsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], WsGateway.prototype, "server", void 0);
exports.WsGateway = WsGateway = WsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: { origin: '*' } }),
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WsGateway);
let WsModule = class WsModule {
};
exports.WsModule = WsModule;
exports.WsModule = WsModule = __decorate([
    (0, common_1.Module)({
        providers: [prisma_service_1.PrismaService, WsGateway],
        exports: [WsGateway],
    })
], WsModule);
