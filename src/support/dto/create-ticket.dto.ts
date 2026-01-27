import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  subject!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  orderId?: number;
}
