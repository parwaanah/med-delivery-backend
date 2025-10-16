import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

@Injectable()
export class RidersService {
  // ✅ Create new rider (also creates linked User)
  async createRider(name: string, phone: string, vehicleNumber: string, password = 'rider123') {
    if (!name || !phone || !vehicleNumber) {
      throw new BadRequestException('Name, phone, and vehicle number are required');
    }

    // check if phone or email already used
    const existingUser = await prisma.user.findFirst({ where: { email: `${phone}@rider.com` } });
    if (existingUser) {
      throw new BadRequestException('Rider already exists for this phone number');
    }

    // create user first
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email: `${phone}@rider.com`,
        password: hashed,
        role: 'rider',
      },
    });

    // create rider profile linked to user
    return prisma.rider.create({
      data: {
        name,
        phone,
        vehicleNumber,
        userId: user.id,
      },
    });
  }

  // ✅ Get all riders
  async getAllRiders() {
    return prisma.rider.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ✅ Update rider availability or details
  async updateRider(id: number, data: { name?: string; phone?: string; isAvailable?: boolean }) {
    const rider = await prisma.rider.findUnique({ where: { id } });
    if (!rider) throw new NotFoundException('Rider not found');

    return prisma.rider.update({
      where: { id },
      data,
    });
  }

  // ✅ Delete a rider and linked user
  async deleteRider(id: number) {
    const rider = await prisma.rider.findUnique({ where: { id } });
    if (!rider) throw new NotFoundException('Rider not found');

    await prisma.user.delete({ where: { id: rider.userId } });
    return prisma.rider.delete({ where: { id } });
  }
}
