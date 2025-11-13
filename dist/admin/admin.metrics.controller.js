"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminMetricsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
let AdminMetricsController = class AdminMetricsController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getMetrics() {
        const uptime = process.uptime();
        const mem = process.memoryUsage();
        const cpuLoad = os.loadavg();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        let redisPing;
        try {
            const { stdout } = await execAsync('redis-cli ping');
            redisPing = stdout.trim();
        }
        catch {
            redisPing = 'unreachable';
        }
        let activeConnections = 0;
        try {
            const dbSessions = (await this.prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM pg_stat_activity WHERE datname = current_database();`));
            activeConnections = parseInt(dbSessions?.[0]?.count || '0', 10);
        }
        catch {
            activeConnections = 0;
        }
        const [ordersCount, usersCount, pharmaciesCount, ridersCount] = await Promise.all([
            this.prisma.order.count(),
            this.prisma.user.count(),
            this.prisma.user.count({ where: { role: 'PHARMACY' } }),
            this.prisma.user.count({ where: { role: 'RIDER' } }),
        ]);
        return {
            orders: { total: ordersCount },
            users: { count: usersCount },
            pharmacies: { count: pharmaciesCount },
            riders: { count: ridersCount },
            system: {
                hostname: os.hostname(),
                platform: os.platform(),
                cpuLoad1m: cpuLoad[0].toFixed(2),
                totalMemMB: Math.round(totalMem / 1024 / 1024),
                usedMemMB: Math.round((totalMem - freeMem) / 1024 / 1024),
                uptimeMinutes: Math.round(uptime / 60),
            },
            redis: redisPing,
            database: { activeConnections },
            node: {
                rssMB: Math.round(mem.rss / 1024 / 1024),
                heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
                heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
            },
            timestamp: new Date().toISOString(),
        };
    }
};
exports.AdminMetricsController = AdminMetricsController;
__decorate([
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminMetricsController.prototype, "getMetrics", null);
exports.AdminMetricsController = AdminMetricsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN, 'ADMIN', 'admin'),
    (0, common_1.Controller)('admin/metrics'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminMetricsController);
