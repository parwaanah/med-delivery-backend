import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../prisma/prisma.service'; // ✅ Corrected path
import { AdminModule } from '../admin/admin.module'; // ✅ For AuditService

@Module({
  imports: [
    AdminModule, // ✅ Access to AuditService
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    PrismaService, // ✅ Local Prisma provider
  ],
  exports: [
    OrdersService, // ✅ Allow reuse by other modules if needed
  ],
})
export class OrdersModule {}
