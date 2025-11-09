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
var RiderLiveGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiderLiveGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
let RiderLiveGateway = RiderLiveGateway_1 = class RiderLiveGateway {
    constructor() {
        this.logger = new common_1.Logger(RiderLiveGateway_1.name);
    }
    broadcast(event, data) {
        this.server.emit(event, data);
        this.logger.log(`📡 Broadcast event: ${event}`, JSON.stringify(data));
    }
    notifyAdmins(event, data) {
        this.server.to('admin').emit(event, data);
        this.logger.log(`🧭 Sent admin notification → ${event}`, JSON.stringify(data));
    }
    handleRiderUpdate(payload) {
        this.logger.log(`📍 Rider update received`, JSON.stringify(payload));
        this.broadcast('rider_update', payload);
    }
};
exports.RiderLiveGateway = RiderLiveGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], RiderLiveGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('rider_update'),
    __param(0, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RiderLiveGateway.prototype, "handleRiderUpdate", null);
exports.RiderLiveGateway = RiderLiveGateway = RiderLiveGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: '*' },
        namespace: '/rider-live',
    })
], RiderLiveGateway);
