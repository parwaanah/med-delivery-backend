import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderItemDto } from './order-item.dto';

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsString()
  address!: string;

  // optional: prefixed pharmacy (direct order)
  @IsOptional()
  @IsNumber()
  pharmacyId?: number;

  // optional prescriptionId if customer already uploaded
  @IsOptional()
  @IsNumber()
  prescriptionId?: number;

  // location fallbacks
  @IsOptional()
  pickupLat?: number;

  @IsOptional()
  pickupLon?: number;

  @IsOptional()
  customerLat?: number;

  @IsOptional()
  customerLng?: number;
}
