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

  // ---------------------------------------------------------------------
  // LIST INVENTORY
  // ---------------------------------------------------------------------
  async listInventory(pharmacyId: number) {
    return this.prisma.pharmacyInventory.findMany({
      where: { pharmacyId },
      include: { medicine: true },
    });
  }

  // ---------------------------------------------------------------------
  // ADD INVENTORY ITEM
  // ---------------------------------------------------------------------
  async add(pharmacyId: number, dto: any) {
    const { medicineId, mrp, sellingPrice, discount = 0, stock = 0 } = dto;

    if (!medicineId) throw new BadRequestException('medicineId required');

    return this.prisma.pharmacyInventory.upsert({
      where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
      update: {
        mrp,
        sellingPrice,
        discount,
        stock,
      },
      create: {
        pharmacyId,
        medicineId,
        mrp,
        sellingPrice,
        discount,
        stock,
      },
    });
  }

  // ---------------------------------------------------------------------
  // UPDATE INVENTORY ITEM
  // ---------------------------------------------------------------------
  async update(inventoryId: number, dto: any) {
    const rec = await this.prisma.pharmacyInventory.findUnique({
      where: { id: inventoryId },
    });

    if (!rec) throw new NotFoundException('Inventory record not found');

    return this.prisma.pharmacyInventory.update({
      where: { id: inventoryId },
      data: {
        mrp: dto.mrp ?? rec.mrp,
        sellingPrice: dto.sellingPrice ?? rec.sellingPrice,
        discount: dto.discount ?? rec.discount,
        stock: dto.stock ?? rec.stock,
      },
    });
  }

  // ---------------------------------------------------------------------
  // REMOVE INVENTORY ITEM
  // ---------------------------------------------------------------------
  async remove(inventoryId: number) {
    const rec = await this.prisma.pharmacyInventory.findUnique({
      where: { id: inventoryId },
    });

    if (!rec) throw new NotFoundException('Inventory not found');

    await this.prisma.pharmacyInventory.delete({
      where: { id: inventoryId },
    });

    return { ok: true, deletedId: inventoryId };
  }

  // ---------------------------------------------------------------------
  // GET PRICE
  // ---------------------------------------------------------------------
  async getMedicinePrice(pharmacyId: number, medicineId: number) {
    const rec = await this.prisma.pharmacyInventory.findUnique({
      where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
    });

    if (!rec) throw new NotFoundException('Medicine not found in inventory');

    return { price: Number(rec.sellingPrice), stock: rec.stock };
  }

  // ---------------------------------------------------------------------
  // PRICE WITH SURGE
  // ---------------------------------------------------------------------
  async calculatePrice(pharmacyId: number, medicineId: number) {
    const base = await this.getMedicinePrice(pharmacyId, medicineId);
    const { multiplier } = await this.surge.getStatus();

    const price = Number((base.price * multiplier).toFixed(2));

    return { price, basePrice: base.price, multiplier };
  }

  // ---------------------------------------------------------------------
  // UPDATE STOCK DELTA
  // ---------------------------------------------------------------------
  async updateStock(pharmacyId: number, medicineId: number, delta: number) {
    if (!Number.isFinite(delta)) throw new BadRequestException('delta required');

    const rec = await this.prisma.pharmacyInventory.findUnique({
      where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
    });

    if (!rec) throw new NotFoundException('inventory record not found');

    const newStock = Math.max(0, rec.stock + delta);

    return this.prisma.pharmacyInventory.update({
      where: { id: rec.id },
      data: { stock: newStock },
    });
  }
}
