import { IsInt, IsNumber, Min } from 'class-validator';

export class CreateInventoryDto {
  @IsInt()
  medicineId!: number;

  @IsNumber()
  @Min(0)
  mrp!: number;

  @IsNumber()
  @Min(0)
  sellingPrice!: number;

  @IsNumber()
  @Min(0)
  discount!: number; // percent

  @IsInt()
  @Min(0)
  stock!: number;
}
