import { PartialType } from '@nestjs/mapped-types';
import { CreateNoticeDto } from './create-notice.dto';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateNoticeDto extends PartialType(CreateNoticeDto) {
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

