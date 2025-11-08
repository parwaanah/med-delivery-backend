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
let AuditLiveGateway = AuditLiveGateway_1 = class AuditLiveGateway {
    constructor() {
        this.logger = new common_1.Logger(AuditLiveGateway_1.name);
    }
    handleConnection(client) {
        this.logger.log(`🟢 Admin connected: ${client.id}`);
    }
    handleDisconnect(client) {
        this.logger.log(`🔴 Admin disconnected: ${client.id}`);
    }
    emitAuditEvent(event) {
        if (!this.server)
            return;
        this.server.emit('audit_event', event);
        this.logger.debug(`📡 Emitted audit event: ${JSON.stringify(event)}`);
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
    })
], AuditLiveGateway);
