import { Module } from '@nestjs/common';
import { RidersService } from './riders.service';
import { RidersController } from './riders.controller';
import { PrismaService } from '../utils/prisma.service';

@Module({
  controllers: [RidersController],
  providers: [RidersService, PrismaService],
})
export class RidersModule {}
