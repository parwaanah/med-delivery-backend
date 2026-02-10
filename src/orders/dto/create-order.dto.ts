import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderItemDto } from './order-item.dto';
import { PaymentMode } from '@prisma/client';

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  // Backward-compatible freeform address string (legacy clients)
  @IsOptional()
  @IsString()
  address?: string;

  // Preferred: link a saved address (will be snapshotted on Order)
  @IsOptional()
  @IsNumber()
  addressId?: number;

  @IsOptional()
  @IsString()
  deliveryNotes?: string;

  // Optional: client-requested payment mode; server may override (e.g. Rx => PAY_AFTER_VERIFICATION)
  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode;

  // optional: prefixed pharmacy (direct order)
  @IsOptional()
  @IsNumber()
  pharmacyId?: number;

  // optional prescriptionId if customer already uploaded
  @IsOptional()
  @IsNumber()
  prescriptionId?: number;

  @IsOptional()
  @IsString()
  couponCode?: string;

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
