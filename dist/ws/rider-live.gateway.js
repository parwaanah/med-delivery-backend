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
var RiderLiveGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiderLiveGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
let RiderLiveGateway = RiderLiveGateway_1 = class RiderLiveGateway {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(RiderLiveGateway_1.name);
    }
    handleConnection(client) {
        this.logger.log(`🟢 RiderLive connected: ${client.id}`);
        client.on('joinRoom', (payload) => {
            if (payload?.room) {
                client.join(payload.room);
                this.logger.debug(`Client ${client.id} joined room ${payload.room}`);
            }
        });
        client.on('location_update', async (payload) => {
            try {
                if (!payload?.riderId || typeof payload.lat !== 'number' || typeof payload.lng !== 'number')
                    return;
                const update = {
                    riderId: payload.riderId,
                    lat: payload.lat,
                    lng: payload.lng,
                    heading: payload.heading ?? null,
                    speed: payload.speed ?? null,
                    at: new Date().toISOString(),
                };
                this.prisma.user.update({
                    where: { id: payload.riderId },
                    data: { latitude: payload.lat, longitude: payload.lng },
                }).catch((e) => this.logger.warn('Failed to persist rider location', e));
                this.server.to(`rider-${payload.riderId}`).emit('location', update);
                this.server.to('admin').emit('rider_location', update);
                this.server.emit('rider_feed', { riderId: payload.riderId, lat: payload.lat, lng: payload.lng });
            }
            catch (err) {
                this.logger.error('location_update handler failed', err);
            }
        });
    }
    handleDisconnect(client) {
        this.logger.log(`🔴 RiderLive disconnected: ${client.id}`);
    }
    notifyRiderLocation(riderId, payload) {
        try {
            this.server.to(`rider-${riderId}`).emit('location', payload);
        }
        catch (err) {
            this.logger.warn('notifyRiderLocation failed', err);
        }
    }
    notifyAdmins(event, payload) {
        try {
            this.server.to('admin').emit(event, payload);
        }
        catch (err) {
            this.logger.warn('notifyAdmins failed', err);
        }
    }
};
exports.RiderLiveGateway = RiderLiveGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], RiderLiveGateway.prototype, "server", void 0);
exports.RiderLiveGateway = RiderLiveGateway = RiderLiveGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        namespace: '/rider-live',
        cors: { origin: '*' },
    }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RiderLiveGateway);
