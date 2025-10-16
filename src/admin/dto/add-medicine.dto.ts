import { IsNotEmpty, IsNumber, IsString, Min, IsOptional } from 'class-validator';

export class AddMedicineDto {
  @IsNumber()
  pharmacyId: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(1)
  price: number;

  @IsNumber()
  @Min(0)
  stock: number;
}
