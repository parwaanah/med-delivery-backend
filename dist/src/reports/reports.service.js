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
    async generateDailyReport() {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const from = new Date(`${dateStr}T00:00:00.000Z`);
        const to = new Date(`${dateStr}T23:59:59.999Z`);
        const orders = await this.prisma.order.findMany({
            include: { pharmacy: true, rider: true, items: true, customer: true },
            where: { createdAt: { gte: from, lt: to } },
            orderBy: { createdAt: 'asc' },
        });
        const reportsDir = path.join(process.cwd(), 'reports');
        fs.mkdirSync(reportsDir, { recursive: true });
        const jsonFilename = path.join(reportsDir, `report-${dateStr}.json`);
        fs.writeFileSync(jsonFilename, JSON.stringify(orders, null, 2));
        this.logger.log(`📄 JSON report generated: ${jsonFilename}`);
        const pdfFilename = path.join(reportsDir, `report-${dateStr}.pdf`);
        await this.createPdfReport(orders, dateStr, pdfFilename);
        this.logger.log(`📄 PDF report generated: ${pdfFilename}`);
        const csvFilename = path.join(reportsDir, `report-${dateStr}.csv`);
        await this.createCsvReport(orders, csvFilename);
        this.logger.log(`📄 CSV report generated: ${csvFilename}`);
        return { json: jsonFilename, pdf: pdfFilename, csv: csvFilename };
    }
    async createPdfReport(orders, dateStr, pdfPath) {
        return new Promise((resolve, reject) => {
            const doc = new pdfkit_1.default({ margin: 40 });
            const stream = fs.createWriteStream(pdfPath);
            doc.pipe(stream);
            doc.fontSize(18).text(`Daily Orders Report — ${dateStr}`, { underline: true });
            doc.moveDown();
            if (orders.length === 0) {
                doc.fontSize(12).text('No orders for this date.');
            }
            else {
                orders.forEach((o) => {
                    doc.fontSize(12).text(`Order #${o.id} — ${o.status} — Total: ${o.totalPrice}`);
                    doc.fontSize(10).text(`Customer: ${o.customer?.email ?? 'N/A'} | Pharmacy: ${o.pharmacy?.email ?? 'N/A'} | Rider: ${o.rider?.email ?? 'N/A'}`);
                    if (o.items?.length) {
                        o.items.forEach((it) => {
                            doc.text(`  • ${it.name} x${it.quantity} @ ${it.price}`);
                        });
                    }
                    doc.moveDown(0.5);
                });
            }
            doc.end();
            stream.on('finish', () => resolve());
            stream.on('error', (e) => reject(e));
        });
    }
    async createCsvReport(orders, csvPath) {
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: csvPath,
            header: [
                { id: 'orderId', title: 'Order ID' },
                { id: 'createdAt', title: 'Created At' },
                { id: 'status', title: 'Status' },
                { id: 'customer', title: 'Customer Email' },
                { id: 'pharmacy', title: 'Pharmacy Email' },
                { id: 'rider', title: 'Rider Email' },
                { id: 'totalPrice', title: 'Total Price' },
                { id: 'items', title: 'Items' },
            ],
        });
        const records = orders.map((o) => ({
            orderId: o.id,
            createdAt: o.createdAt?.toISOString?.() ?? '',
            status: o.status,
            customer: o.customer?.email ?? '',
            pharmacy: o.pharmacy?.email ?? '',
            rider: o.rider?.email ?? '',
            totalPrice: o.totalPrice,
            items: (o.items ?? []).map((it) => `${it.name} x${it.quantity}`).join(' | '),
        }));
        await csvWriter.writeRecords(records);
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = ReportsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReportsService);
