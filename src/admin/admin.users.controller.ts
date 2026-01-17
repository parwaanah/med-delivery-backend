import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { WsGateway } from '../ws/ws.gateway';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private prisma: PrismaService,
    private ws: WsGateway,
  ) {}

  @Get('pending/:role')
  async pending(@Param('role') role: string) {
    if (!Object.values(UserRole).includes(role as UserRole)) {
      throw new BadRequestException('Invalid role');
    }

    const users = await this.prisma.user.findMany({
      where: { role: role as UserRole, status: 'PENDING' },
      include: { verificationDocs: true },
      orderBy: { createdAt: 'asc' },
    });

    return { users };
  }

  @Get(':id/documents')
  async documents(@Param('id') id: string) {
    const userId = Number(id);
    if (isNaN(userId)) throw new BadRequestException('Invalid user');

    return this.prisma.verificationDocument.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Patch(':id/documents/:docId/verify')
  async verifyDoc(
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    const userId = Number(id);
    const documentId = Number(docId);

    await this.prisma.verificationDocument.update({
      where: { id: documentId },
      data: { verified: true },
    });

    const remaining = await this.prisma.verificationDocument.count({
      where: { userId, verified: false },
    });

    if (remaining === 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { status: 'APPROVED' },
      });

      this.ws.notifyUser(userId, 'user.approved', { status: 'APPROVED' });
    }

    return { success: true };
  }

  @Patch(':id/reject')
  async reject(@Param('id') id: string) {
    const userId = Number(id);

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'REJECTED' },
    });

    this.ws.notifyUser(userId, 'user.rejected', { status: 'REJECTED' });

    return { success: true };
  }
}
