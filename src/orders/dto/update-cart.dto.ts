// src/orders/dto/update-cart.dto.ts
import { IsNumber, Min } from 'class-validator';

export class UpdateCartItemDto {
  @IsNumber()
  medicineId!: number;

  @IsNumber()
  @Min(0)
  quantity!: number;
}

export class UpdateCartDto {
  @IsNumber()
  orderId!: number;

  items!: UpdateCartItemDto[];
}
