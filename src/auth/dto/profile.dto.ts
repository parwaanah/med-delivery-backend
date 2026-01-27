import {
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PharmacyAddressDto {
  @IsString()
  @IsNotEmpty()
  line1!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  pin!: string;
}

export class PharmacyBankDetailsDto {
  @IsString()
  @IsNotEmpty()
  accountName!: string;

  @IsString()
  @IsNotEmpty()
  accountNumber!: string;

  @IsString()
  @IsNotEmpty()
  ifsc!: string;

  @IsString()
  @IsNotEmpty()
  bankName!: string;
}

export class PharmacyProfileDto {
  @IsString()
  @IsNotEmpty()
  pharmacyName!: string;

  @IsString()
  @IsNotEmpty()
  ownerName!: string;

  @ValidateNested()
  @Type(() => PharmacyAddressDto)
  address!: PharmacyAddressDto;

  @IsString()
  @IsNotEmpty()
  gstNumber!: string;

  @IsString()
  @IsNotEmpty()
  drugLicenseNumber!: string;

  @IsString()
  @IsNotEmpty()
  openingHours!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PharmacyBankDetailsDto)
  bankDetails?: PharmacyBankDetailsDto;
}
