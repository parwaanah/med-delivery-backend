// src/pharmacies/dto/update-inventory.dto.ts
import { IsInt, IsNumber } from 'class-validator';

export class UpdateInventoryDto {
  @IsNumber()
  delta!: number;
}
