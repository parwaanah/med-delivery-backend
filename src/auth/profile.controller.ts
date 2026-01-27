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
import { Prisma, UserRole } from '@prisma/client';
import { PharmacyProfileDto } from './dto/profile.dto';

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
  async saveMyProfile(
    @Req() req: any,
    @Body() data: PharmacyProfileDto,
  ) {
    const jsonData = JSON.parse(
      JSON.stringify(data),
    ) as Prisma.InputJsonValue;

    return this.prisma.partnerProfile.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id,
        role: UserRole.PHARMACY,
        data: jsonData,
      },
      update: {
        data: jsonData,
      },
    });
  }

  // ================================
  // GET /profile/status
  // ================================
  @Get('status')
  async getStatus(@Req() req: any) {
    const userId = req.user.id;

    const [profile, docs, user] = await Promise.all([
      this.prisma.partnerProfile.findUnique({
        where: { userId },
      }),
      this.prisma.verificationDocument.findMany({
        where: { userId },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { status: true },
      }),
    ]);

    const data = (profile?.data || {}) as any;
    const profileComplete =
      typeof data.pharmacyName === 'string' &&
      data.pharmacyName.trim() &&
      typeof data.ownerName === 'string' &&
      data.ownerName.trim() &&
      typeof data.gstNumber === 'string' &&
      data.gstNumber.trim() &&
      typeof data.drugLicenseNumber === 'string' &&
      data.drugLicenseNumber.trim() &&
      typeof data.openingHours === 'string' &&
      data.openingHours.trim() &&
      data.address &&
      typeof data.address.line1 === 'string' &&
      data.address.line1.trim() &&
      typeof data.address.city === 'string' &&
      data.address.city.trim() &&
      typeof data.address.pin === 'string' &&
      data.address.pin.trim();

    const docsUploaded = docs.length > 0;
    const docsVerified =
      docsUploaded && docs.every((d) => d.verified === true);

    return {
      profileComplete: Boolean(profileComplete),
      docsUploaded,
      docsVerified,
      accountStatus: user?.status ?? 'PENDING',
    };
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
