// src/modules/profile/profile.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Get,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrismaService } from '../utils/prisma.service';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PHARMACY)
@Controller('profile')
export class ProfileController {
  constructor(
    private prisma: PrismaService,
    private cloud: CloudinaryService,
  ) {}

  // ================================
  // GET /profile/me
  // ================================
  @Get('me')
  async getMyProfile(@Req() req: any) {
    return this.prisma.partnerProfile.findUnique({
      where: { userId: req.user.id },
    });
  }

  // ================================
  // POST /profile/me
  // ================================
  @Post('me')
  async saveMyProfile(@Req() req: any, @Body() data: any) {
    return this.prisma.partnerProfile.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id,
        role: UserRole.PHARMACY,
        data,
      },
      update: {
        data,
      },
    });
  }

  // ================================
  // POST /profile/documents
  // ================================
  @Post('documents')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Req() req: any,
    @UploadedFile() file: any,
    @Body('type') type: string,
  ) {
    if (!file) throw new BadRequestException('File required');
    if (!type) throw new BadRequestException('Document type required');

    const uploaded = await this.cloud.uploadBuffer(
      file.buffer,
      'verification_docs',
    );

    return this.prisma.verificationDocument.create({
      data: {
        userId: req.user.id,
        url: uploaded.secure_url,
        type, // e.g. DRUG_LICENSE, GST_CERT
      },
    });
  }

  // ================================
  // GET /profile/documents
  // ================================
  @Get('documents')
  async listDocuments(@Req() req: any) {
    return this.prisma.verificationDocument.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
  }
}
