// src/payments/payments.module.ts
import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { RazorpayService } from './razorpay.service';
import { PrismaService } from '../utils/prisma.service';

@Module({
  imports: [],
  controllers: [PaymentsController],
  providers: [PaymentsService, RazorpayService, PrismaService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
