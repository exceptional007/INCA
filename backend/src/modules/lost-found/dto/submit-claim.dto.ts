import { IsString, IsNotEmpty, MaxLength, IsOptional, IsUrl } from 'class-validator';

export class SubmitClaimDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  claimDetails: string;

  @IsOptional()
  @IsString()
  proofImageUrl?: string;
}

