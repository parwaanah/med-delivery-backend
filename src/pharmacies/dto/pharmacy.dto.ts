import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class CreatePharmacyDto {
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @MinLength(6)
  password!: string;
}

export class UpdatePharmacyDto {
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
