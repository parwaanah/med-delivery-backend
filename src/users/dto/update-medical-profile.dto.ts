import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMedicalProfileDto {
  @ApiPropertyOptional({ example: ['Penicillin', 'Peanuts'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  allergies?: string[];

  @ApiPropertyOptional({ example: ['Diabetes', 'Hypertension'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  conditions?: string[];

  @ApiPropertyOptional({ example: 'Any extra notes for the pharmacist/doctor.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

