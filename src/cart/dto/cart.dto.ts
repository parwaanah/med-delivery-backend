// src/cart/dto/cart.dto.ts
import { IsArray, ValidateNested, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

class CartItem {
  @IsInt() pharmacyId!: number;
  @IsInt() medicineId!: number;
  @IsInt() quantity!: number;
}

export class CartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItem)
  items!: CartItem[];
}
