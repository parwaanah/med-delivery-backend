import { IsString, IsOptional, IsNumber } from 'class-validator';

export class RefundDto {
  @IsString()
  transactionId!: string;

  @IsOptional()
  @IsNumber()
  amount?: number;
}
