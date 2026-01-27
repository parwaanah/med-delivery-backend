import { Module } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserAddressesController } from './user-addresses.controller';
import { UserAddressesService } from './user-addresses.service';

@Module({
  providers: [UsersService, UserAddressesService, PrismaService],
  controllers: [UsersController, UserAddressesController],
  exports: [UsersService],
})
export class UsersModule {}
