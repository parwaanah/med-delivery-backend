import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class MedicinesService {
  // Get all medicines or filter by pharmacy
  async getMedicines(pharmacyId?: number) {
    const where = pharmacyId ? { pharmacyId } : {};
    return prisma.medicine.findMany({ where });
  }

  // Helper: for controller calls
  async getMedicinesByPharmacy(pharmacyId: number) {
    return this.getMedicines(pharmacyId);
  }

  async getAllMedicines() {
    return this.getMedicines();
  }

  // Create new medicine
  async createMedicine(
    name: string,
    price: number,
    stock: number,
    pharmacyId: number
  ) {
    const pharmacy = await prisma.pharmacy.findUnique({ where: { id: pharmacyId } });
    if (!pharmacy) throw new BadRequestException('Pharmacy not found');

    return prisma.medicine.create({
      data: { name, price, stock, pharmacyId },
    });
  }

  // Update medicine details
  async updateMedicine(
    id: number,
    data: { name?: string; price?: number; stock?: number }
  ) {
    const med = await prisma.medicine.findUnique({ where: { id } });
    if (!med) throw new BadRequestException('Medicine not found');

    return prisma.medicine.update({ where: { id }, data });
  }

  // Delete medicine
  async deleteMedicine(id: number) {
    const med = await prisma.medicine.findUnique({ where: { id } });
    if (!med) throw new BadRequestException('Medicine not found');

    return prisma.medicine.delete({ where: { id } });
  }
}
