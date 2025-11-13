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
exports.AdminAuditGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const socket_io_1 = require("socket.io");
const prisma_service_1 = require("../utils/prisma.service");
let AdminAuditGateway = class AdminAuditGateway {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger('AdminAuditGateway');
        this.logger.log('✅ AdminAuditGateway initialized');
    }
    handleConnection(client) {
        this.logger.log(`🟢 Admin connected: ${client.id}`);
    }
    handleDisconnect(client) {
        this.logger.log(`🔴 Admin disconnected: ${client.id}`);
    }
    async broadcastAuditEvent(event, payload) {
        this.logger.debug(`📡 Emitting audit event: ${event}`);
        this.server.emit('audit_event', { event, payload });
    }
    async notifyLoginActivity(data) {
        this.server.emit('login_audit', data);
    }
};
exports.AdminAuditGateway = AdminAuditGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], AdminAuditGateway.prototype, "server", void 0);
exports.AdminAuditGateway = AdminAuditGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ namespace: '/admin-audit', cors: { origin: '*' } }),
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminAuditGateway);
