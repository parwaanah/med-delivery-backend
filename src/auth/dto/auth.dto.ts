import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  MinLength,
  IsString,
  ValidateIf,
  Matches,
} from "class-validator";
import { UserRole } from "@prisma/client";

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  // Email OR Phone required
  @ValidateIf((o) => !o.phone)
  @IsEmail()
  @IsOptional()
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsString()
  @IsOptional()
  phone?: string;

  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, {
    message: "Password must include letters and numbers",
  })
  @IsString()
  password!: string;

  @IsOptional()
  role?: UserRole;
}

export class LoginDto {
  // Email OR Phone required
  @ValidateIf((o) => !o.phone)
  @IsEmail()
  @IsOptional()
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsString()
  @IsOptional()
  phone?: string;

  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, {
    message: "Password must include letters and numbers",
  })
  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  mfaCode?: string;

  @IsOptional()
  @IsString()
  recoveryCode?: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}

export class SendOtpDto {
  @IsString()
  phone!: string;
}

export class SendEmailVerificationDto {
  @IsEmail()
  email!: string;
}

export class VerifyOtpDto {
  @IsString()
  phone!: string;

  @IsString()
  otp!: string;

  @IsOptional()
  @IsString()
  mfaCode?: string;

  @IsOptional()
  @IsString()
  recoveryCode?: string;
}

export class MfaVerifyDto {
  @IsString()
  code!: string;
}

export class MfaDisableDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  recoveryCode?: string;
}

export class ForgotPasswordDto {
  // Email OR Phone required
  @ValidateIf((o) => !o.phone)
  @IsEmail()
  @IsOptional()
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsString()
  @IsOptional()
  phone?: string;
}

export class ResetPasswordDto {
  // Email OR Phone required
  @ValidateIf((o) => !o.phone)
  @IsEmail()
  @IsOptional()
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  otp!: string;

  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, {
    message: "Password must include letters and numbers",
  })
  @IsString()
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, {
    message: "Password must include letters and numbers",
  })
  @IsString()
  newPassword!: string;

  @IsOptional()
  @IsString()
  mfaCode?: string;

  @IsOptional()
  @IsString()
  recoveryCode?: string;
}
