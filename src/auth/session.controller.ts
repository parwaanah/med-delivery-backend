// src/auth/session.controller.ts
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Sessions')
@Controller('sessions')
export class SessionController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':userId')
  async getUserSessions(@Param('userId') userId: number) {
    return this.prisma.session.findMany({
      where: { userId: Number(userId), revoked: false },
      select: { id: true, ip: true, userAgent: true, createdAt: true, expiresAt: true },
    });
  }

  @Post('revoke')
  async revokeSession(@Body('sessionId') sessionId: number) {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revoked: true },
    });
    await this.prisma.refreshToken.updateMany({
      where: { sessionId },
      data: { revoked: true },
    });
    return { message: `Session ${sessionId} revoked` };
  }
}
