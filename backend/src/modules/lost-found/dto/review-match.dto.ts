import { IsEnum, IsNotEmpty } from 'class-validator';
import { MatchStatus } from '@prisma/client';

export class ReviewMatchDto {
  @IsEnum(MatchStatus)
  @IsNotEmpty()
  status: MatchStatus;
}

