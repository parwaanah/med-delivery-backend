// src/pharmacies/pharmacy-inventory.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { SurgeService } from '../surge/surge.service';
import { NotificationService } from '../utils/notification.service';

@Injectable()
export class PharmacyInventoryService {
  constructor(
    private prisma: PrismaService,
    private surge: SurgeService,
    private notify: NotificationService,
  ) {}

  async listInventory(pharmacyId: number) {
    return this.prisma.pharmacyInventory.findMany({
      where: { pharmacyId },
      include: { medicine: true },
    });
  }

  async getMedicinePrice(pharmacyId: number, medicineId: number) {
    const rec = await this.prisma.pharmacyInventory.findUnique({
      where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
    });
    if (!rec) throw new NotFoundException('Medicine not found in inventory');
    return { price: rec.price, stock: rec.stock };
  }

  async calculatePrice(pharmacyId: number, medicineId: number) {
    const base = await this.getMedicinePrice(pharmacyId, medicineId);
    const { multiplier } = await this.surge.getStatus();
    const price = Number((base.price * multiplier).toFixed(2));
    return { price, basePrice: base.price, multiplier };
  }

  async updateStock(pharmacyId: number, medicineId: number, delta: number) {
    if (!Number.isFinite(delta)) throw new BadRequestException('delta required');
    const rec = await this.prisma.pharmacyInventory.findUnique({
      where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
    });
    if (!rec) throw new NotFoundException('inventory record not found');
    const stock = Math.max(0, rec.stock + delta);
    return this.prisma.pharmacyInventory.update({
      where: { id: rec.id },
      data: { stock },
    });
  }
}
