// src/reports/reports.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { createObjectCsvWriter } from 'csv-writer';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private prisma: PrismaService) {}

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

    // JSON
    const jsonFilename = path.join(reportsDir, `report-${dateStr}.json`);
    fs.writeFileSync(jsonFilename, JSON.stringify(orders, null, 2));
    this.logger.log(`📄 JSON report generated: ${jsonFilename}`);

    // PDF
    const pdfFilename = path.join(reportsDir, `report-${dateStr}.pdf`);
    await this.createPdfReport(orders, dateStr, pdfFilename);
    this.logger.log(`📄 PDF report generated: ${pdfFilename}`);

    // CSV
    const csvFilename = path.join(reportsDir, `report-${dateStr}.csv`);
    await this.createCsvReport(orders, csvFilename);
    this.logger.log(`📄 CSV report generated: ${csvFilename}`);

    return { json: jsonFilename, pdf: pdfFilename, csv: csvFilename };
  }

  private async createPdfReport(orders: any[], dateStr: string, pdfPath: string) {
    return new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40 });
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      doc.fontSize(18).text(`Daily Orders Report — ${dateStr}`, { underline: true });
      doc.moveDown();

      if (orders.length === 0) {
        doc.fontSize(12).text('No orders for this date.');
      } else {
        orders.forEach((o: any) => { // ✅ added type hint
          doc.fontSize(12).text(`Order #${o.id} — ${o.status} — Total: ${o.totalPrice}`);
          doc.fontSize(10).text(
            `Customer: ${o.customer?.email ?? 'N/A'} | Pharmacy: ${o.pharmacy?.email ?? 'N/A'} | Rider: ${o.rider?.email ?? 'N/A'}`
          );
          if (o.items?.length) {
            o.items.forEach((it: any) => { // ✅ explicit type
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

  private async createCsvReport(orders: any[], csvPath: string) {
    const csvWriter = createObjectCsvWriter({
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

    const records = orders.map((o: any) => ({ // ✅ explicit type
      orderId: o.id,
      createdAt: o.createdAt?.toISOString?.() ?? '',
      status: o.status,
      customer: o.customer?.email ?? '',
      pharmacy: o.pharmacy?.email ?? '',
      rider: o.rider?.email ?? '',
      totalPrice: o.totalPrice,
      items: (o.items ?? []).map((it: any) => `${it.name} x${it.quantity}`).join(' | '), // ✅ explicit type
    }));

    await csvWriter.writeRecords(records);
  }
}
