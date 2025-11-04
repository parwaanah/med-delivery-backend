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
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("./prisma.service");
const admin_audit_gateway_1 = require("../ws/admin.audit.gateway");
let AuditService = class AuditService {
    constructor(prisma, auditGateway) {
        this.prisma = prisma;
        this.auditGateway = auditGateway;
    }
    async log({ userId, email, ip, userAgent, eventType, role, success = true, }) {
        const record = await this.prisma.loginAudit.create({
            data: { userId, email, ip, userAgent, eventType, role, success },
        });
        try {
            this.auditGateway.server?.emit('audit_event', {
                event: 'LOGIN_AUDIT',
                data: record,
            });
            console.log('📡 Audit event emitted:', eventType);
        }
        catch (err) {
            console.warn('⚠️ Audit broadcast failed:', err);
        }
        return record;
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        admin_audit_gateway_1.AdminAuditGateway])
], AuditService);
