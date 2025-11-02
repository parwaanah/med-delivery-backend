import { IsEmail, IsNotEmpty, IsOptional, MinLength, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @MinLength(6)
  password!: string;

  @IsOptional()
  role?: UserRole;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @MinLength(6)
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}
