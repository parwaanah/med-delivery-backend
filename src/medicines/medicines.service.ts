import { Injectable } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';

@Injectable()
export class MedicinesService {
  constructor(private prisma: PrismaService) {}

  private devFallbackStock() {
    const raw = Number(process.env.DEV_DEFAULT_STOCK ?? 0);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }

  private devFallbackPrice() {
    const raw = Number(process.env.DEV_DEFAULT_PRICE ?? 0);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }

  /* ---------------------------------
     SEARCH
  --------------------------------- */
  async searchMedicines(query: string) {
    const q = (query || '').trim();
    if (!q) return [];

    const medicines = await this.prisma.medicine.findMany({
      where: {
        name: { contains: q, mode: 'insensitive' },
      },
      take: 50,
      orderBy: { id: 'asc' },
      include: {
        inventory: {
          where: { deletedAt: null },
          orderBy: { stock: 'desc' },
          take: 1,
          include: {
            pharmacy: { select: { id: true, name: true } },
          },
        },
      },
    });

    return medicines.map((m) => {
      const inv = m.inventory?.[0];
      const fallbackPrice = Number(m.price ?? 0) || this.devFallbackPrice();
      const fallbackStock = this.devFallbackStock();
      return {
        ...m,
        stock: inv ? (inv.stock ?? 0) : fallbackStock,
        price: Number(inv?.sellingPrice ?? fallbackPrice),
        mrp: Number(inv?.mrp ?? 0),
        discount: Number(inv?.discount ?? 0),
        pharmacy: inv?.pharmacy?.name ?? '',
        pharmacyId: inv?.pharmacy?.id ?? 0,
      };
    });
  }

  /* ---------------------------------
     FEATURED
  --------------------------------- */
  async getFeaturedMedicines() {
    const medicines = await this.prisma.medicine.findMany({
      take: 16,
      orderBy: { createdAt: 'desc' },
      include: {
        inventory: {
          where: { deletedAt: null },
          orderBy: { stock: 'desc' },
          take: 1,
          include: {
            pharmacy: { select: { id: true, name: true } },
          },
        },
      },
    });

    return medicines.map((m) => {
      const inv = m.inventory?.[0];
      const fallbackPrice = Number(m.price ?? 0) || this.devFallbackPrice();
      const fallbackStock = this.devFallbackStock();
      return {
        ...m,
        stock: inv ? (inv.stock ?? 0) : fallbackStock,
        price: Number(inv?.sellingPrice ?? fallbackPrice),
        mrp: Number(inv?.mrp ?? 0),
        discount: Number(inv?.discount ?? 0),
        pharmacy: inv?.pharmacy?.name ?? '',
        pharmacyId: inv?.pharmacy?.id ?? 0,
      };
    });
  }

  /* ---------------------------------
     SINGLE MEDICINE (DETAIL PAGE)
  --------------------------------- */
  async getMedicineById(id: number) {
    const m = await this.prisma.medicine.findUnique({
      where: { id },
      include: {
        inventory: {
          where: { deletedAt: null },
          orderBy: { stock: 'desc' },
          take: 1,
          include: {
            pharmacy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!m) return null;

    const inv = m.inventory?.[0];
    const fallbackPrice = Number(m.price ?? 0) || this.devFallbackPrice();
    const fallbackStock = this.devFallbackStock();
    return {
      ...m,
      stock: inv ? (inv.stock ?? 0) : fallbackStock,
      price: Number(inv?.sellingPrice ?? fallbackPrice),
      mrp: Number(inv?.mrp ?? 0),
      discount: Number(inv?.discount ?? 0),
      pharmacy: inv?.pharmacy?.name ?? '',
      pharmacyId: inv?.pharmacy?.id ?? 0,
    };
  }
}
