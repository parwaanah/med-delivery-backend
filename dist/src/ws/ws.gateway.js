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
exports.WsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
let WsGateway = WsGateway_1 = class WsGateway {
    constructor() {
        this.logger = new common_1.Logger(WsGateway_1.name);
        this.users = new Map();
        this.admins = new Set();
    }
    handleConnection(client) {
        const userId = Number(client.handshake.query.userId);
        const role = client.handshake.query.role?.toUpperCase() ?? 'UNKNOWN';
        if (!isNaN(userId))
            this.users.set(userId, client.id);
        if (role === 'ADMIN')
            this.admins.add(client.id);
        this.logger.log(`WS connected: ${client.id} user=${userId} role=${role}`);
    }
    handleDisconnect(client) {
        this.users.forEach((sid, uid) => {
            if (sid === client.id)
                this.users.delete(uid);
        });
        this.admins.delete(client.id);
        this.logger.log(`WS disconnected: ${client.id}`);
    }
    notifyUser(userId, event, payload) {
        const socketId = this.users.get(userId);
        if (socketId) {
            this.server.to(socketId).emit(event, payload);
        }
    }
    notifyAdmins(event, payload) {
        for (const sid of this.admins) {
            this.server.to(sid).emit(event, payload);
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
exports.WsGateway = WsGateway = WsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: '*' },
        namespace: '/',
    })
], WsGateway);
