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
var SurgeLiveGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SurgeLiveGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
let SurgeLiveGateway = SurgeLiveGateway_1 = class SurgeLiveGateway {
    constructor() {
        this.logger = new common_1.Logger(SurgeLiveGateway_1.name);
    }
    handleConnection(client) {
        this.logger.log(`🟢 Surge client connected: ${client.id}`);
    }
    handleDisconnect(client) {
        this.logger.log(`🔴 Surge client disconnected: ${client.id}`);
    }
    broadcastSurge(data) {
        if (!this.server)
            return;
        this.server.emit('surge_update', data);
        this.logger.debug(`📡 Surge broadcast → x${data.multiplier} | D=${data.demand} | S=${data.supply} | T=${data.timestamp}`);
    }
};
exports.SurgeLiveGateway = SurgeLiveGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], SurgeLiveGateway.prototype, "server", void 0);
exports.SurgeLiveGateway = SurgeLiveGateway = SurgeLiveGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: '*' },
        namespace: '/surge-live',
    })
], SurgeLiveGateway);
