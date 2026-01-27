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
var RiderSettlementCron_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiderSettlementCron = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const rider_payments_service_1 = require("./rider-payments.service");
let RiderSettlementCron = RiderSettlementCron_1 = class RiderSettlementCron {
    constructor(payments) {
        this.payments = payments;
        this.logger = new common_1.Logger(RiderSettlementCron_1.name);
    }
    async weekly() {
        const now = new Date();
        const periodEnd = this.startOfWeek(now);
        const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
        try {
            await this.payments.createWeeklyBatch(periodStart, periodEnd);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Weekly rider settlement failed: ${msg}`);
        }
    }
    startOfWeek(d) {
        const date = new Date(d);
        date.setHours(0, 0, 0, 0);
        const day = date.getDay();
        const diffToMonday = (day + 6) % 7;
        date.setDate(date.getDate() - diffToMonday);
        return date;
    }
};
exports.RiderSettlementCron = RiderSettlementCron;
__decorate([
    (0, schedule_1.Cron)('10 0 * * 1'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RiderSettlementCron.prototype, "weekly", null);
exports.RiderSettlementCron = RiderSettlementCron = RiderSettlementCron_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [rider_payments_service_1.RiderPaymentsService])
], RiderSettlementCron);
