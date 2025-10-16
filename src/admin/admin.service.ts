import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient, $Enums } from '@prisma/client'; // ✅ import $Enums for enum types

const prisma = new PrismaClient();

@Injectable()
export class AdminService {
  // ✅ Create a pharmacy
  async createPharmacy(name: string, address: string, phone: string) {
    if (!name || !address || !phone) {
      throw new BadRequestException('Name, address, and phone are required');
    }

    return await prisma.pharmacy.create({
      data: { name, address, phone },
    });
  }

  // ✅ Add a new medicine to a pharmacy
  async addMedicine(
    pharmacyId: number,
    name: string,
    price: number,
    stock: number,
  ) {
    const pharmacy = await prisma.pharmacy.findUnique({ where: { id: pharmacyId } });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');

    return await prisma.medicine.create({
      data: { name, price, stock, pharmacyId },
    });
  }

  // ✅ Update stock for a medicine
  async updateMedicineStock(medicineId: number, stock: number) {
    const medicine = await prisma.medicine.findUnique({ where: { id: medicineId } });
    if (!medicine) throw new NotFoundException('Medicine not found');

    return await prisma.medicine.update({
      where: { id: medicineId },
      data: { stock },
    });
  }

  // ✅ Fetch all orders (admin view)
  async getAllOrders() {
    return await prisma.order.findMany({
      include: {
        user: true,
        pharmacy: true,
        items: { include: { medicine: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ✅ Update order status (admin)
  async updateOrderStatus(orderId: number, status: string) {
    const validStatuses = [
      'pending',
      'accepted',
      'picked_up',
      'delivered',
      'cancelled',
    ];

    if (!validStatuses.includes(status)) {
      throw new BadRequestException(
        `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      );
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    // ✅ Convert to Prisma Enum
    return await prisma.order.update({
      where: { id: orderId },
      data: { status: status as $Enums.OrderStatus },
      include: {
        user: true,
        pharmacy: true,
        items: { include: { medicine: true } },
      },
    });
  }
}
