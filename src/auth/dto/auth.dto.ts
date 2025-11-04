import { IsEmail, IsNotEmpty, IsOptional, MinLength, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name of the user' })
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'john@example.com', description: 'Email address of the user' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123', description: 'Password (min 6 characters)' })
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'CUSTOMER', required: false, enum: UserRole, description: 'Optional role for the user' })
  @IsOptional()
  role?: UserRole;
}

export class LoginDto {
  @ApiProperty({ example: 'john@example.com', description: 'User email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123', description: 'User password' })
  @MinLength(6)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    example: 'your-refresh-token-here',
    description: 'Refresh token obtained from /auth/login',
  })
  @IsString()
  refreshToken!: string;
}
