import { PartialType } from '@nestjs/mapped-types';
import { CreateNoticeDto } from './create-notice.dto';
import { IsDateString, IsOptional } from 'class-validator';

// Review decisions and archive state can only change through dedicated actions.
export class UpdateNoticeDto extends PartialType(CreateNoticeDto) {
  @IsOptional()
  @IsDateString()
  expectedUpdatedAt?: string;
}
