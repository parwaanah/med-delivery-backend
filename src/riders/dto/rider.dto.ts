import { IsEmail, IsNotEmpty, IsOptional, MinLength, IsIn } from 'class-validator';

export class CreateRiderDto {
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @MinLength(6)
  password!: string;
}

export class UpdateRiderDto {
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class UpdateStatusDto {
  @IsIn(['AVAILABLE', 'BUSY', 'OFFLINE'])
  status!: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
}
