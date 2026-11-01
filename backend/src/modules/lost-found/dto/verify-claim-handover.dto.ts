import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifyClaimHandoverDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'Verification OTP must be exactly 6 digits' })
  verificationCode: string;
}

