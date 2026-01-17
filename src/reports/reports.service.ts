import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { Transaction } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { createObjectCsvWriter } from 'csv-writer';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =====================================================
  // SYSTEM SUMMARY
  // =====================================================
  async getSystemSummary() {
    const [totalOrders, paidOrders, txs] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'PAID' } }),
      this.prisma.transaction.findMany(),
    ]);

    const revenuePaise = txs
      .filter((t: Transaction) => t.status === 'SUCCESS')
      .reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0);

    const refundedPaise = txs
      .filter((t: Transaction) => t.status === 'REFUNDED')
      .reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0);

    return {
      totalOrders,
      paidOrders,
      revenue: revenuePaise / 100,
      refundedAmount: refundedPaise / 100,
      transactions: txs.length,
    };
  }

  // =====================================================
  // TRANSACTIONS (PAGINATED)
  // =====================================================
  async getTransactions(params: {
    page: number;
    limit: number;
    status?: string;
  }) {
    const skip = (params.page - 1) * params.limit;

    const where: { status?: string } = {};
    if (params.status) where.status = params.status;

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
      items: items.map((t: Transaction) => ({
        ...t,
        amount: Number(t.amount) / 100, // always rupees for frontend
      })),
    };
  }

  // =====================================================
  // DAILY REPORT (FILES)
  // =====================================================
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

  // -----------------------------------------------------
  private async createPdfReport(
    orders: any[],
    dateStr: string,
    pdfPath: string,
  ) {
    return new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40 });
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      doc.fontSize(18).text(`Daily Orders Report — ${dateStr}`, {
        underline: true,
      });
      doc.moveDown();

      if (!orders.length) {
        doc.text('No orders for this date.');
      } else {
        orders.forEach((o: any) => {
          doc.text(
            `Order #${o.id} — ${o.status} — Total ₹${o.totalPrice}`,
          );
        });
      }

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }

  // -----------------------------------------------------
  private async createCsvReport(orders: any[], csvPath: string) {
    const csvWriter = createObjectCsvWriter({
      path: csvPath,
      header: [
        { id: 'orderId', title: 'Order ID' },
        { id: 'status', title: 'Status' },
        { id: 'totalPrice', title: 'Total Price' },
      ],
    });

    await csvWriter.writeRecords(
      orders.map((o: any) => ({
        orderId: o.id,
        status: o.status,
        totalPrice: o.totalPrice,
      })),
    );
  }
}
