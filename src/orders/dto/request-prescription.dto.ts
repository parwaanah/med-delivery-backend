import { IsString } from 'class-validator';

export class RequestPrescriptionDto {
  @IsString()
  message!: string; // Example: "Please upload a valid diabetes medicine prescription"
}
