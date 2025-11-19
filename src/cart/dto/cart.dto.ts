// src/cart/dto/cart.dto.ts
import { IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CartItemDto {
  @IsNumber()
  price!: number;

  @IsNumber()
  quantity!: number;

  @IsNumber()
  medicineId!: number;

  name!: string;
}

export class CartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items!: CartItemDto[];
}
