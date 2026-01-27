import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class AdminPostMessageDto {
  @IsString()
  message!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @IsOptional()
  @IsBoolean()
  internal?: boolean;
}
