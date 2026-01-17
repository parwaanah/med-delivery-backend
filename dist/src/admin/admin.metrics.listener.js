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
var AdminMetricsListener_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminMetricsListener = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const admin_metrics_service_1 = require("./admin.metrics.service");
const ws_gateway_1 = require("../ws/ws.gateway");
let AdminMetricsListener = AdminMetricsListener_1 = class AdminMetricsListener {
    constructor(metrics, ws) {
        this.metrics = metrics;
        this.ws = ws;
        this.logger = new common_1.Logger(AdminMetricsListener_1.name);
    }
    async pushLiveMetrics() {
        try {
            const data = await this.metrics.getMetrics();
            this.ws.notifyAdmins('admin_metrics', data);
            this.logger.debug('Admin metrics pushed');
        }
        catch (err) {
            this.logger.warn('Failed to push admin metrics', err?.message ?? err);
        }
    }
};
exports.AdminMetricsListener = AdminMetricsListener;
__decorate([
    (0, schedule_1.Interval)(10_000),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminMetricsListener.prototype, "pushLiveMetrics", null);
exports.AdminMetricsListener = AdminMetricsListener = AdminMetricsListener_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [admin_metrics_service_1.AdminMetricsService,
        ws_gateway_1.WsGateway])
], AdminMetricsListener);
