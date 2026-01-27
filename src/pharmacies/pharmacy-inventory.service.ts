// src/pharmacies/pharmacy-inventory.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    return this.prisma.pharmacyInventory.findMany(({
      where: { pharmacyId, deletedAt: null },
      include: { medicine: true },
    } as any));
  }

  // ---------------------------------------------------------------------
  // ADD INVENTORY ITEM
  // ---------------------------------------------------------------------
  async add(pharmacyId: number, dto: any) {
    const { medicineId, mrp, sellingPrice, discount = 0, stock = 0 } = dto;

    if (!medicineId) throw new BadRequestException('medicineId required');
    if (mrp == null || sellingPrice == null) {
      throw new BadRequestException('mrp and sellingPrice required');
    }

    const mrpDec = new Prisma.Decimal(mrp);
    const sellingDec = new Prisma.Decimal(sellingPrice);

    return this.prisma.pharmacyInventory.upsert({
      where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
      update: {
        mrp: mrpDec,
        sellingPrice: sellingDec,
        discount,
        stock,
        deletedAt: null,
      },
      create: {
        pharmacyId,
        medicineId,
        mrp: mrpDec,
        sellingPrice: sellingDec,
        discount,
        stock,
        deletedAt: null,
      },
    } as any);
  }

  // ---------------------------------------------------------------------
  // UPDATE INVENTORY ITEM
  // ---------------------------------------------------------------------
  async update(inventoryId: number, dto: any) {
    const rec: any = await this.prisma.pharmacyInventory.findUnique({
      where: { id: inventoryId },
    });

    if (!rec || rec.deletedAt) throw new NotFoundException('Inventory record not found');

    const mrp =
      dto.mrp != null ? new Prisma.Decimal(dto.mrp) : rec.mrp;
    const sellingPrice =
      dto.sellingPrice != null
        ? new Prisma.Decimal(dto.sellingPrice)
        : rec.sellingPrice;

    return this.prisma.pharmacyInventory.update({
      where: { id: inventoryId },
      data: {
        mrp,
        sellingPrice,
        discount: dto.discount ?? rec.discount,
        stock: dto.stock ?? rec.stock,
      },
    } as any);
  }

  // ---------------------------------------------------------------------
  // REMOVE INVENTORY ITEM
  // ---------------------------------------------------------------------
  async remove(inventoryId: number) {
    const rec: any = await this.prisma.pharmacyInventory.findUnique({
      where: { id: inventoryId },
    });

    if (!rec || rec.deletedAt) throw new NotFoundException('Inventory not found');

    await this.prisma.pharmacyInventory.update(({
      where: { id: inventoryId },
      data: { deletedAt: new Date(), stock: 0 },
    } as any));

    return { ok: true, deletedId: inventoryId, softDeleted: true };
  }

  // ---------------------------------------------------------------------
  // GET PRICE
  // ---------------------------------------------------------------------
  async getMedicinePrice(pharmacyId: number, medicineId: number) {
    const rec: any = await this.prisma.pharmacyInventory.findUnique({
      where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
    });

    if (!rec || rec.deletedAt) throw new NotFoundException('Medicine not found in inventory');

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

    const rec: any = await this.prisma.pharmacyInventory.findUnique({
      where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
    });

    if (!rec || rec.deletedAt) throw new NotFoundException('inventory record not found');

    const newStock = Math.max(0, rec.stock + delta);

    return this.prisma.pharmacyInventory.update({
      where: { id: rec.id },
      data: { stock: newStock },
    } as any);
  }
}
