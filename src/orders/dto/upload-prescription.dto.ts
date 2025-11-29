import { IsString } from 'class-validator';

export class UploadPrescriptionDto {
  @IsString()
  url!: string;
}
