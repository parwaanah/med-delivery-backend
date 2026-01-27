import { IsNumber, IsOptional, IsString } from 'class-validator';

export class RequestRefundDto {
  @IsNumber()
  orderId!: number;

  @IsOptional()
  @IsNumber()
  amount?: number; // INR

  @IsOptional()
  @IsString()
  reason?: string;
}

