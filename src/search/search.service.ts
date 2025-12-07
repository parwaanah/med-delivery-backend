import { Injectable } from "@nestjs/common";
import { PrismaService } from "../utils/prisma.service";

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

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

      return {
        id: m.id,
        name: m.name,
        category: m.category,
        rxType: m.rxType,

        price: inv ? inv.sellingPrice : 0,
        stock: inv ? inv.stock : 0,
        pharmacy: inv ? inv.pharmacy : null,
      };
    });
  }
}
