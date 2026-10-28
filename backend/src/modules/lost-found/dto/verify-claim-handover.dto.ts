import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyClaimHandoverDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Verification OTP must be exactly 6 characters' })
  verificationCode: string;
}

