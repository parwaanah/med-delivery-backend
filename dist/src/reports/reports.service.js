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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var ReportsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const csv_writer_1 = require("csv-writer");
let ReportsService = ReportsService_1 = class ReportsService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(ReportsService_1.name);
    }
    async getSystemSummary() {
        const [totalOrders, paidOrders, txs] = await Promise.all([
            this.prisma.order.count(),
            this.prisma.order.count({ where: { status: 'PAID' } }),
            this.prisma.transaction.findMany(),
        ]);
        const revenuePaise = txs
            .filter((t) => t.status === 'SUCCESS')
            .reduce((sum, t) => sum + Number(t.amount), 0);
        const refundedPaise = txs
            .filter((t) => t.status === 'REFUNDED')
            .reduce((sum, t) => sum + Number(t.amount), 0);
        return {
            totalOrders,
            paidOrders,
            revenue: revenuePaise / 100,
            refundedAmount: refundedPaise / 100,
            transactions: txs.length,
        };
    }
    async getTransactions(params) {
        const skip = (params.page - 1) * params.limit;
        const where = {};
        if (params.status)
            where.status = params.status;
        const [items, total] = await this.prisma.$transaction([
            this.prisma.transaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: params.limit,
            }),
            this.prisma.transaction.count({ where }),
        ]);
        return {
            page: params.page,
            limit: params.limit,
            total,
            items: items.map((t) => ({
                ...t,
                amount: Number(t.amount) / 100,
            })),
        };
    }
    async generateDailyReport() {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const from = new Date(`${dateStr}T00:00:00.000Z`);
        const to = new Date(`${dateStr}T23:59:59.999Z`);
        const orders = await this.prisma.order.findMany({
            include: {
                pharmacy: true,
                rider: true,
                items: true,
                customer: true,
            },
            where: { createdAt: { gte: from, lt: to } },
            orderBy: { createdAt: 'asc' },
        });
        const reportsDir = path.join(process.cwd(), 'reports');
        fs.mkdirSync(reportsDir, { recursive: true });
        const jsonFilename = path.join(reportsDir, `report-${dateStr}.json`);
        fs.writeFileSync(jsonFilename, JSON.stringify(orders, null, 2));
        const pdfFilename = path.join(reportsDir, `report-${dateStr}.pdf`);
        await this.createPdfReport(orders, dateStr, pdfFilename);
        const csvFilename = path.join(reportsDir, `report-${dateStr}.csv`);
        await this.createCsvReport(orders, csvFilename);
        this.logger.log(`📊 Daily reports generated for ${dateStr}`);
        return {
            json: jsonFilename,
            pdf: pdfFilename,
            csv: csvFilename,
        };
    }
    async createPdfReport(orders, dateStr, pdfPath) {
        return new Promise((resolve, reject) => {
            const doc = new pdfkit_1.default({ margin: 40 });
            const stream = fs.createWriteStream(pdfPath);
            doc.pipe(stream);
            doc.fontSize(18).text(`Daily Orders Report — ${dateStr}`, {
                underline: true,
            });
            doc.moveDown();
            if (!orders.length) {
                doc.text('No orders for this date.');
            }
            else {
                orders.forEach((o) => {
                    doc.text(`Order #${o.id} — ${o.status} — Total ₹${o.totalPrice}`);
                });
            }
            doc.end();
            stream.on('finish', resolve);
            stream.on('error', reject);
        });
    }
    async createCsvReport(orders, csvPath) {
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: csvPath,
            header: [
                { id: 'orderId', title: 'Order ID' },
                { id: 'status', title: 'Status' },
                { id: 'totalPrice', title: 'Total Price' },
            ],
        });
        await csvWriter.writeRecords(orders.map((o) => ({
            orderId: o.id,
            status: o.status,
            totalPrice: o.totalPrice,
        })));
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = ReportsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReportsService);
