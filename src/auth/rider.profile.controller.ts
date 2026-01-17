import {
  Controller,
  Post,
  Get,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../utils/prisma.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from '../uploads/cloudinary.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RIDER)
@Controller('rider/profile')
export class RiderProfileController {
  constructor(
    private prisma: PrismaService,
    private cloud: CloudinaryService,
  ) {}

  @Get('documents')
  async listDocs(@Req() req: any) {
    return this.prisma.verificationDocument.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('documents')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDoc(
    @Req() req: any,
    @UploadedFile() file: any,
    @Req() body: any,
  ) {
    if (!file) throw new BadRequestException('File required');
    if (!body?.type) throw new BadRequestException('Document type required');

    const uploaded = await this.cloud.uploadBuffer(
      file.buffer,
      'verification_docs',
    );

    return this.prisma.verificationDocument.create({
      data: {
        userId: req.user.id,
        type: body.type,
        url: uploaded.secure_url,
      },
    });
  }
}
