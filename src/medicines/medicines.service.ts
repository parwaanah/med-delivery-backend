// backend/src/medicines/medicines.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';

@Injectable()
export class MedicinesService {
  constructor(private prisma: PrismaService) {}

  async searchMedicines(query: string) {
    const q = (query || '').trim();
    if (!q) return [];

    // Get matching medicines
    const medicines = await this.prisma.medicine.findMany({
      where: {
        name: {
          contains: q,
          mode: 'insensitive',
        },
      },
      take: 50,
      orderBy: { id: 'asc' },
    });

    // Enrich with inventory + pharmacy
    return Promise.all(
      medicines.map(async (m) => {
        const inv = await this.prisma.pharmacyInventory.findFirst({
          where: { medicineId: m.id },
          include: {
            pharmacy: { select: { id: true, name: true } },
          },
        });

        return {
          ...m,
          stock: inv?.stock ?? 0,
          price: inv ? Number(inv.sellingPrice) : 0,
          mrp: inv ? Number(inv.mrp) : 0,
          discount: inv ? Number(inv.discount || 0) : 0,
          pharmacy: inv?.pharmacy?.name ?? null,
          pharmacyId: inv?.pharmacy?.id ?? null,
        };
      })
    );
  }
}
