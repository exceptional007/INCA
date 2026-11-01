import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ClaimStatus } from '@prisma/client';

export class ReviewClaimDto {
  @IsIn([ClaimStatus.APPROVED, ClaimStatus.REJECTED])
  @IsNotEmpty()
  status: ClaimStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  staffNote?: string;
}

