import { IsNumber } from 'class-validator';

export class CreateIntentDto {
  @IsNumber()
  orderId!: number;
}
