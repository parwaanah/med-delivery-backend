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

  /* ---------------------------------
     SUBSTITUTES (salt match)
  --------------------------------- */
  async getSubstitutesByMedicineId(id: number) {
    const base = await this.prisma.medicine.findUnique({
      where: { id },
      select: { id: true, salt: true },
    });
    if (!base) return [];
    const saltRaw = String(base.salt || '').trim();
    if (!saltRaw) return [];

    const normalizeSalt = (s: string) =>
      s
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[().]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const baseSalt = normalizeSalt(saltRaw);
    const tokens = Array.from(
      new Set(
        baseSalt
          .split(/[,/;+]/g)
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ).slice(0, 5);

    const primaryToken = tokens[0] || baseSalt;

    const medicines = await this.prisma.medicine.findMany({
      where: {
        id: { not: base.id },
        // Broad match to reduce false negatives; we rank in-memory afterward.
        OR: [
          { salt: { contains: primaryToken, mode: 'insensitive' } },
          { salt: { contains: saltRaw, mode: 'insensitive' } },
        ],
      },
      take: 20,
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

    const ranked = medicines
      .map((m) => ({ m, s: normalizeSalt(String((m as any).salt || '')) }))
      .sort((a, b) => {
        const aExact = a.s === baseSalt ? 1 : 0;
        const bExact = b.s === baseSalt ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;

        const score = (s: string) => tokens.reduce((acc, t) => acc + (s.includes(t) ? 1 : 0), 0);
        const aScore = score(a.s);
        const bScore = score(b.s);
        if (aScore !== bScore) return bScore - aScore;

        // Prefer in-stock items, then cheaper price.
        const aInv = (a.m as any).inventory?.[0];
        const bInv = (b.m as any).inventory?.[0];
        const aStock = aInv ? Number(aInv.stock ?? 0) : 0;
        const bStock = bInv ? Number(bInv.stock ?? 0) : 0;
        if (aStock !== bStock) return bStock - aStock;

        const aPrice = aInv ? Number(aInv.sellingPrice ?? 0) : Number((a.m as any).price ?? 0);
        const bPrice = bInv ? Number(bInv.sellingPrice ?? 0) : Number((b.m as any).price ?? 0);
        if (Number.isFinite(aPrice) && Number.isFinite(bPrice) && aPrice !== bPrice) return aPrice - bPrice;

        return a.m.id - b.m.id;
      })
      .map(({ m }) => m);

    return ranked.map((m) => {
      const inv = (m as any).inventory?.[0];
      const fallbackPrice = Number((m as any).price ?? 0) || this.devFallbackPrice();
      const fallbackStock = this.devFallbackStock();
      return {
        ...(m as any),
        stock: inv ? (inv.stock ?? 0) : fallbackStock,
        price: Number(inv?.sellingPrice ?? fallbackPrice),
        mrp: Number(inv?.mrp ?? 0),
        discount: Number(inv?.discount ?? 0),
        pharmacy: inv?.pharmacy?.name ?? '',
        pharmacyId: inv?.pharmacy?.id ?? 0,
      };
    });
  }
}
