import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  UseGuards,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, 'ADMIN', 'admin')
@Controller('admin/users')
export class AdminUsersController {
  private readonly logger = new Logger(AdminUsersController.name);

  constructor(private prisma: PrismaService) {}

  @Get()
  async getAllUsers() {
    const users = await this.prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, status: true },
      orderBy: { id: 'desc' },
    });
    return { total: users.length, users };
  }

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

  @Delete(':id')
  async deleteUser(@Param('id') id: number) {
    const userId = Number(id);
    if (isNaN(userId)) throw new NotFoundException('Invalid user ID');

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!existing) throw new NotFoundException(`User #${userId} not found`);

    try {
      await this.prisma.$transaction([
        this.prisma.refreshToken.deleteMany({ where: { userId } }),
        this.prisma.session.deleteMany({ where: { userId } }),
        this.prisma.user.delete({ where: { id: userId } }),
      ]);

      this.logger.log(`Deleted user #${userId} (${existing.email})`);
      return { message: `User #${userId} deleted successfully` };
    } catch (err) {
      this.logger.error(`Failed to delete user #${userId}`, err as any);
      throw new InternalServerErrorException('Failed to delete user — see server logs');
    }
  }
}
