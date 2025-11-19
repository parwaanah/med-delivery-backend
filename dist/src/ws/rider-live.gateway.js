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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiderLiveGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const riders_service_1 = require("../riders/riders.service");
let RiderLiveGateway = class RiderLiveGateway {
    constructor(riders) {
        this.riders = riders;
    }
    handleConnection(client) {
        console.log('Rider WS connected:', client.id);
    }
    handleDisconnect(client) {
        console.log('Rider WS disconnected:', client.id);
    }
    async updateLocation(client, data) {
        if (!data?.riderId)
            return;
        await this.riders.updateLocationWS(data.riderId, data.lat, data.lon);
    }
};
exports.RiderLiveGateway = RiderLiveGateway;
__decorate([
    (0, websockets_1.SubscribeMessage)('rider_update'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RiderLiveGateway.prototype, "updateLocation", null);
exports.RiderLiveGateway = RiderLiveGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: true }),
    __metadata("design:paramtypes", [riders_service_1.RidersService])
], RiderLiveGateway);
