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
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const ws_gateway_1 = require("../ws/ws.gateway");
let NotificationService = class NotificationService {
    constructor(prisma, wsGateway) {
        this.prisma = prisma;
        this.wsGateway = wsGateway;
    }
    async create(receiverId, type, message, meta, senderId) {
        const n = await this.prisma.notification.create({
            data: {
                receiverId,
                senderId: senderId ?? null,
                type,
                message,
                meta: meta ?? null,
            },
        });
        try {
            this.wsGateway.notifyUser(receiverId, 'notification', n);
        }
        catch (err) {
        }
        return n;
    }
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ws_gateway_1.WsGateway])
], NotificationService);
