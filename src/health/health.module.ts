import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../utils/prisma.service';
import { ConfigService } from '@nestjs/config';
import { UtilsModule } from '../utils/utils.module';

@Module({
  imports: [UtilsModule],
  controllers: [HealthController],
  providers: [PrismaService, ConfigService],
  exports: [],
})
export class HealthModule {}
