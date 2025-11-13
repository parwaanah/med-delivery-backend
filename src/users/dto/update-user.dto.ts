// src/users/dto/update-user.dto.ts
import { IsEmail, IsOptional, IsString, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'PHARMACY',
    enum: UserRole,
    description: 'User role (optional update)',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
