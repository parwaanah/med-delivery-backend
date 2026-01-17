import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { RiderProfileController } from './rider.profile.controller';

import { PrismaService } from '../utils/prisma.service';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [
    UploadsModule, // ✅ CloudinaryService available here
  ],
  controllers: [
    ProfileController,
    RiderProfileController,
  ],
  providers: [PrismaService],
})
export class ProfileModule {}
