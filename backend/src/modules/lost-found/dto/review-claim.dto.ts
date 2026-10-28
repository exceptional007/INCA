import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ClaimStatus } from '@prisma/client';

export class ReviewClaimDto {
  @IsEnum(ClaimStatus)
  @IsNotEmpty()
  status: ClaimStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  staffNote?: string;
}

