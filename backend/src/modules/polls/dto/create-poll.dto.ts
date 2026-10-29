import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PollVotingMode, PollResultVisibility } from '@prisma/client';

export class CreatePollDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(2, { message: 'A poll must have at least 2 options' })
  @ArrayMaxSize(10, { message: 'A poll cannot have more than 10 options' })
  @IsString({ each: true })
  options: string[];

  @IsOptional()
  @IsEnum(PollVotingMode)
  votingMode?: PollVotingMode = PollVotingMode.SINGLE_CHOICE;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean = false;

  @IsOptional()
  @IsEnum(PollResultVisibility)
  resultVisibility?: PollResultVisibility = PollResultVisibility.ALWAYS_PUBLIC;

  @IsDateString()
  @IsNotEmpty()
  expiresAt: string;

  @IsOptional()
  @IsDateString()
  resultsPublishAt?: string;

  @IsOptional()
  @IsString()
  targetScope?: string = 'ALL';

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  programId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  targetYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  targetSemester?: number;

  @IsOptional()
  @IsString()
  targetBatch?: string;

  @IsOptional()
  targetAudience?: any;
}

