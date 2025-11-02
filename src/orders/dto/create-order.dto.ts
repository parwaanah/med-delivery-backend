// src/orders/dto/create-order.dto.ts
import { IsOptional, IsInt, IsArray, ValidateNested, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @IsOptional()
  @IsInt()
  medicineId?: number;

  @IsString()
  name!: string;

  @IsInt()
  quantity!: number;

  @IsNumber()
  price!: number;
}

export class CreateOrderDto {
  @IsOptional()
  @IsInt()
  pharmacyId?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsOptional()
  location?: any;
}
