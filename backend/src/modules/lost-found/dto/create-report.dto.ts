import { IsString, IsNotEmpty, IsEnum, IsOptional, MaxLength, IsDateString } from 'class-validator';
import { LostFoundType, LostFoundCategory } from '@prisma/client';

export class CreateReportDto {
  @IsEnum(LostFoundType)
  @IsNotEmpty()
  type: LostFoundType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  description: string;

  @IsEnum(LostFoundCategory)
  @IsNotEmpty()
  category: LostFoundCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  location: string;

  @IsDateString()
  @IsNotEmpty()
  approximateDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  approximateTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  distinguishingFeatures?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactPreference?: string;
}

