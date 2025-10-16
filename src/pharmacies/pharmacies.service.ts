import { Injectable } from '@nestjs/common';
import { PrismaClient, Pharmacy, Medicine } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class PharmaciesService {
  async findAll(): Promise<Pharmacy[]> {
    return prisma.pharmacy.findMany({ include: { medicines: true } });
  }

  async findOne(id: number): Promise<Pharmacy | null> {
    return prisma.pharmacy.findUnique({ where: { id }, include: { medicines: true } });
  }

  async create(data: { name: string; address: string; phone: string }): Promise<Pharmacy> {
    return prisma.pharmacy.create({ data });
  }

  async addMedicine(pharmacyId: number, medicineData: { name: string; description?: string; price: number; stock: number }): Promise<Medicine> {
    return prisma.medicine.create({ data: { ...medicineData, pharmacyId } });
  }
}
