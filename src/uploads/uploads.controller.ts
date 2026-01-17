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
  @UseInterceptors(FileInterceptor('file'))
  async uploadDoc(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('File required');
    if (!file.buffer)
      throw new BadRequestException('File buffer missing');

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
