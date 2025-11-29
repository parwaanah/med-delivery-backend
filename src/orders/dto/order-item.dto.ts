import { IsNumber, IsString, Min } from 'class-validator';

export class OrderItemDto {
  @IsNumber()
  medicineId!: number;

  @IsString()
  name!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsNumber()
  price!: number;

  @IsString()
  category!: string;  // NON_RX | CHRONIC | STRICT_RX
}
