import { Module } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { AppConfigController } from './app-config.controller';
import { AppConfigService } from './app-config.service';

@Module({
  controllers: [AppConfigController],
  providers: [PrismaService, AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
