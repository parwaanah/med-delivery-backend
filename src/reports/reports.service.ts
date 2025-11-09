import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private prisma: PrismaService) {}

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

    // create PDF
    const pdfFilename = path.join(reportsDir, `report-${dateStr}.pdf`);
    const doc = new PDFDocument({ margin: 40 });
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

    await new Promise<void>((res, rej) => {
      stream.on('finish', () => res());
      stream.on('error', (e) => rej(e));
    });

    this.logger.log(`📄 Daily PDF report generated: ${pdfFilename}`);
    return { json: jsonFilename, pdf: pdfFilename };
  }
}
