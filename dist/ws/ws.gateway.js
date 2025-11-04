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
exports.WsModule = exports.WsGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const admin_audit_gateway_1 = require("./admin.audit.gateway");
const prisma_service_1 = require("../utils/prisma.service");
let WsGateway = class WsGateway {
    handleConnection(client) {
        client.on('join', (payload) => {
            client.join(`user-${payload.userId}`);
        });
        client.on('disconnect', () => {
            client.rooms.forEach((room) => {
                if (room.startsWith('user-')) {
                    client.leave(room);
                }
            });
        });
    }
    handleDisconnect(client) {
    }
    notifyUser(userId, event, payload) {
        try {
            this.server.to(`user-${userId}`).emit(event, payload);
        }
        catch (err) {
            console.warn(`⚠️ Failed to notify user ${userId}:`, err);
        }
    }
    broadcast(event, payload) {
        this.server.emit(event, payload);
    }
};
exports.WsGateway = WsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], WsGateway.prototype, "server", void 0);
exports.WsGateway = WsGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: { origin: '*' } }),
    (0, common_1.Injectable)()
], WsGateway);
let WsModule = class WsModule {
};
exports.WsModule = WsModule;
exports.WsModule = WsModule = __decorate([
    (0, common_1.Module)({
        providers: [
            prisma_service_1.PrismaService,
            admin_audit_gateway_1.AdminAuditGateway,
            WsGateway,
        ],
        exports: [admin_audit_gateway_1.AdminAuditGateway, WsGateway],
    })
], WsModule);
