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
var AuditLiveGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLiveGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
let AuditLiveGateway = AuditLiveGateway_1 = class AuditLiveGateway {
    constructor(jwt) {
        this.jwt = jwt;
        this.logger = new common_1.Logger(AuditLiveGateway_1.name);
    }
    handleConnection(client) {
        try {
            const token = client.handshake.headers['authorization']?.toString().split(' ')[1];
            if (!token) {
                this.logger.warn(`❌ Connection rejected: Missing token`);
                client.disconnect(true);
                return;
            }
            const decoded = this.jwt.verify(token);
            this.logger.log(`🟢 ${decoded.role} connected: ${client.id}`);
            client.emit('welcome', { event: 'connected', role: decoded.role, userId: decoded.sub });
        }
        catch (err) {
            this.logger.warn(`❌ Invalid token: ${err.message}`);
            client.disconnect(true);
        }
    }
    handleDisconnect(client) {
        this.logger.log(`🔴 Disconnected: ${client.id}`);
    }
    emitAuditEvent(event) {
        if (!this.server)
            return;
        this.server.emit('audit_event', event);
        this.logger.debug(`📡 Audit event → ${JSON.stringify(event)}`);
    }
};
exports.AuditLiveGateway = AuditLiveGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], AuditLiveGateway.prototype, "server", void 0);
exports.AuditLiveGateway = AuditLiveGateway = AuditLiveGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: '*' },
        namespace: '/audit-live',
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], AuditLiveGateway);
