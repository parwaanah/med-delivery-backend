import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { CreateRiderDto, UpdateRiderDto, UpdateStatusDto } from './dto/rider.dto';

@Injectable()
export class RidersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      where: { role: 'RIDER' },
      select: { id: true, name: true, email: true, createdAt: true },
    });
  }

  async findOne(id: number) {
    const rider = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    if (!rider) throw new NotFoundException('Rider not found');
    return rider;
  }

  async create(dto: CreateRiderDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ForbiddenException('Email already in use');

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: dto.password,
        role: 'RIDER',
      },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  async update(id: number, dto: UpdateRiderDto) {
    const rider = await this.prisma.user.findUnique({ where: { id } });
    if (!rider) throw new NotFoundException('Rider not found');

    return this.prisma.user.update({
      where: { id },
      data: { name: dto.name ?? rider.name, email: dto.email ?? rider.email },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  async remove(id: number) {
    const rider = await this.prisma.user.findUnique({ where: { id } });
    if (!rider) throw new NotFoundException('Rider not found');

    await this.prisma.user.delete({ where: { id } });
    return { message: 'Rider deleted successfully' };
  }

  async updateStatus(id: number, dto: UpdateStatusDto) {
    const rider = await this.prisma.user.findUnique({ where: { id } });
    if (!rider) throw new NotFoundException('Rider not found');

    return this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
      select: { id: true, name: true, email: true, status: true },
    });
  }
}
