import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
export class ForgotPasswordDto {
  @IsEmail() @MaxLength(254) email: string;
}
export class NewPasswordDto {
  @IsString()
  @MinLength(12)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'Use 12–72 characters including uppercase, lowercase, and a number.',
  })
  newPassword: string;
}
export class ChangePasswordDto extends NewPasswordDto {
  @IsString() @MinLength(1) @MaxLength(256) currentPassword: string;
}
export class ResetPasswordDto extends NewPasswordDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) token: string;
}
