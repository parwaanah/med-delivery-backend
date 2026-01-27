import { IsNumber, IsOptional, IsString } from 'class-validator';

export class AdminResolveRefundDto {
  @IsOptional()
  @IsNumber()
  amount?: number; // INR (blank = full)

  @IsOptional()
  @IsString()
  note?: string;
}

