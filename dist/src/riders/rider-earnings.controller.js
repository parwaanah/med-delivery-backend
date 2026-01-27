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
exports.RiderEarningsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const approval_guard_1 = require("../common/guards/approval.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const rider_payments_service_1 = require("./rider-payments.service");
let RiderEarningsController = class RiderEarningsController {
    constructor(earnings) {
        this.earnings = earnings;
    }
    summary(req) {
        return this.earnings.getSummary(Number(req.user.id));
    }
    transactions(req, status, limit) {
        return this.earnings.getTransactions(Number(req.user.id), {
            status,
            limit: limit ? Number(limit) : undefined,
        });
    }
};
exports.RiderEarningsController = RiderEarningsController;
__decorate([
    (0, common_1.Get)('summary'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RiderEarningsController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('transactions'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], RiderEarningsController.prototype, "transactions", null);
exports.RiderEarningsController = RiderEarningsController = __decorate([
    (0, common_1.Controller)('rider/earnings'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, approval_guard_1.ApprovalGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.RIDER),
    __metadata("design:paramtypes", [rider_payments_service_1.RiderPaymentsService])
], RiderEarningsController);
