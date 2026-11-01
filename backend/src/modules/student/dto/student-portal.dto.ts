import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class StudentDateDto {
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}
export class StudentAttendanceFilterDto extends StudentDateDto {
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;
  @IsOptional() @IsUUID() subjectId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
export class CreateAttendanceObjectionDto {
  @IsUUID() sessionId: string;
  @IsString() @MinLength(3) @MaxLength(2000) reason: string;
  @IsOptional() @IsEnum(AttendanceStatus) requestedStatus?: AttendanceStatus;
}
export class ReviewAttendanceObjectionDto {
  @IsEnum({ APPROVED: 'APPROVED', REJECTED: 'REJECTED' }) decision:
    'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(2000) remark?: string;
}
