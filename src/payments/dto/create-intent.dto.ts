// src/payments/dto/create-intent.dto.ts
import { IsNumber } from 'class-validator';

export class CreateIntentDto {
  @IsNumber()
  orderId!: number;
}
