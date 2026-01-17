import { Injectable } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';

@Injectable()
export class MedicinesService {
  constructor(private prisma: PrismaService) {}

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
    });

    const enriched = await Promise.all(
      medicines.map(async (m) => {
        const inv = await this.prisma.pharmacyInventory.findFirst({
          where: { medicineId: m.id, stock: { gt: 0 } },
          include: {
            pharmacy: { select: { id: true, name: true } },
          },
        });

        if (!inv) return null;

        return {
          ...m,
          stock: inv.stock,
          price: Number(inv.sellingPrice),
          mrp: Number(inv.mrp),
          discount: Number(inv.discount || 0),
          pharmacy: inv.pharmacy.name,
          pharmacyId: inv.pharmacy.id,
        };
      })
    );

    return enriched.filter(Boolean);
  }

  /* ---------------------------------
     FEATURED
  --------------------------------- */
  async getFeaturedMedicines() {
    const medicines = await this.prisma.medicine.findMany({
      take: 16,
      orderBy: { createdAt: 'desc' },
    });

    const enriched = await Promise.all(
      medicines.map(async (m) => {
        const inv = await this.prisma.pharmacyInventory.findFirst({
          where: { medicineId: m.id, stock: { gt: 0 } },
          include: {
            pharmacy: { select: { id: true, name: true } },
          },
        });

        if (!inv) return null;

        return {
          ...m,
          stock: inv.stock,
          price: Number(inv.sellingPrice),
          mrp: Number(inv.mrp),
          discount: Number(inv.discount || 0),
          pharmacy: inv.pharmacy.name,
          pharmacyId: inv.pharmacy.id,
        };
      })
    );

    return enriched.filter(Boolean);
  }

  /* ---------------------------------
     SINGLE MEDICINE (DETAIL PAGE)
  --------------------------------- */
  async getMedicineById(id: number) {
    const m = await this.prisma.medicine.findUnique({
      where: { id },
    });

    if (!m) return null;

    const inv = await this.prisma.pharmacyInventory.findFirst({
      where: { medicineId: m.id, stock: { gt: 0 } },
      include: {
        pharmacy: { select: { id: true, name: true } },
      },
    });

    if (!inv) return null;

    return {
      ...m,
      stock: inv.stock,
      price: Number(inv.sellingPrice),
      mrp: Number(inv.mrp),
      discount: Number(inv.discount || 0),
      pharmacy: inv.pharmacy.name,
      pharmacyId: inv.pharmacy.id,
    };
  }
}
