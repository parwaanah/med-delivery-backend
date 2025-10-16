import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreatePharmacyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @MinLength(5)
  address: string;

  @IsString()
  @IsNotEmpty()
  phone: string;
}
