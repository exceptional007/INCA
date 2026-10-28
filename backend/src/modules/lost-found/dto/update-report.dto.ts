import { PartialType } from '@nestjs/mapped-types';
import { CreateReportDto } from './create-report.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { LostFoundStatus } from '@prisma/client';

export class UpdateReportDto extends PartialType(CreateReportDto) {
  @IsOptional()
  @IsEnum(LostFoundStatus)
  status?: LostFoundStatus;
}

