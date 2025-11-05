import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private prisma: PrismaService) {}

  @Get('pending')
  async getPendingUsers() {
    const pending = await this.prisma.user.findMany({
      where: { status: 'PENDING' },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
    return { total: pending.length, users: pending };
  }

  @Patch(':id/approve')
  async approveUser(@Param('id') id: number) {
    return this.prisma.user.update({
      where: { id: Number(id) },
      data: { status: 'APPROVED' },
    });
  }

  @Patch(':id/reject')
  async rejectUser(@Param('id') id: number) {
    return this.prisma.user.update({
      where: { id: Number(id) },
      data: { status: 'REJECTED' },
    });
  }
}
