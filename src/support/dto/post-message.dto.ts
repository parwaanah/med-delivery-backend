import { IsArray, IsOptional, IsString } from 'class-validator';

export class PostMessageDto {
  @IsString()
  message!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
