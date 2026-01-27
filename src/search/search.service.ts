import { Injectable } from "@nestjs/common";
import { PrismaService } from "../utils/prisma.service";

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  private devFallbackStock() {
    const raw = Number(process.env.DEV_DEFAULT_STOCK ?? 0);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }

  private devFallbackPrice(mPrice?: number | null) {
    const base = Number(mPrice ?? 0);
    if (Number.isFinite(base) && base > 0) return base;
    const raw = Number(process.env.DEV_DEFAULT_PRICE ?? 0);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }

  async search(query: string) {
    if (!query || query.trim().length < 2) return [];

    const meds = await this.prisma.medicine.findMany({
      where: {
        name: { contains: query, mode: "insensitive" },
      },
      include: {
        inventory: {
          where: {
            pharmacy: { role: "PHARMACY" }, // ensure only pharmacy users
          },
          include: {
            pharmacy: {
              select: {
                id: true,
                name: true,
                latitude: true,
                longitude: true,
              },
            },
          },
        },
      },
    });

    // DELIVER a simplified frontend-ready format
    return meds.map((m) => {
      const inv = m.inventory?.[0];

      const fallbackPrice = this.devFallbackPrice(m.price as any);
      const fallbackStock = this.devFallbackStock();
      return {
        id: m.id,
        name: m.name,
        category: m.category,
        rxType: m.rxType,

        price: inv ? inv.sellingPrice : fallbackPrice,
        stock: inv ? inv.stock : fallbackStock,
        pharmacy: inv ? inv.pharmacy : null,
      };
    });
  }
}
