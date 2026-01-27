// src/modules/uploads/uploads.controller.ts
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from './cloudinary.service';

@Controller('uploads')
export class UploadsController {
  constructor(private cloud: CloudinaryService) {}

  @Post('doc')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: Number(process.env.UPLOAD_MAX_BYTES || 5 * 1024 * 1024) },
    }),
  )
  async uploadDoc(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('File required');
    if (!file.buffer)
      throw new BadRequestException('File buffer missing');
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Unsupported file type');
    }

    const uploaded = await this.cloud.uploadBuffer(
      file.buffer,
      'verification',
    );

    return {
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
    };
  }
}
