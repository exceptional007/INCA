import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class NoticeRevisionDto {
  @IsDateString()
  @IsNotEmpty()
  expectedUpdatedAt: string;
}

export class RejectNoticeDto extends NoticeRevisionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason: string;
}
