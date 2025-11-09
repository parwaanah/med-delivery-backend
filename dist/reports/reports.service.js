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
let ReportsService = ReportsService_1 = class ReportsService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(ReportsService_1.name);
    }
    async generateDailyReport() {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const orders = await this.prisma.order.findMany({
            include: { pharmacy: true, rider: true, items: true, customer: true },
            where: {
                createdAt: {
                    gte: new Date(`${dateStr}T00:00:00.000Z`),
                    lt: new Date(`${dateStr}T23:59:59.999Z`),
                },
            },
        });
        const reportsDir = path.join(process.cwd(), 'reports');
        fs.mkdirSync(reportsDir, { recursive: true });
        const jsonFilename = path.join(reportsDir, `report-${dateStr}.json`);
        fs.writeFileSync(jsonFilename, JSON.stringify(orders, null, 2));
        this.logger.log(`📄 Daily JSON report generated: ${jsonFilename}`);
        const pdfFilename = path.join(reportsDir, `report-${dateStr}.pdf`);
        const doc = new pdfkit_1.default({ margin: 40 });
        const stream = fs.createWriteStream(pdfFilename);
        doc.pipe(stream);
        doc.fontSize(18).text(`Daily Orders Report — ${dateStr}`, { underline: true });
        doc.moveDown();
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
        doc.end();
        await new Promise((res, rej) => {
            stream.on('finish', () => res());
            stream.on('error', (e) => rej(e));
        });
        this.logger.log(`📄 Daily PDF report generated: ${pdfFilename}`);
        return { json: jsonFilename, pdf: pdfFilename };
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = ReportsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReportsService);
