// src/payment/payment.module.ts
import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { UtilsModule } from '../utils/utils.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [UtilsModule, ConfigModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentModule {}
