import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsIn,
  IsBoolean,
  IsDateString,
  IsInt,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TargetAudienceDto } from './target-audience.dto';

export enum NoticeCategory {
  ACADEMIC = 'ACADEMIC',
  EXAMINATION = 'EXAMINATION',
  PLACEMENT = 'PLACEMENT',
  EVENT = 'EVENT',
  CIRCULAR = 'CIRCULAR',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  HOLIDAY = 'HOLIDAY',
  URGENT = 'URGENT',
  GENERAL = 'GENERAL',
}

export enum NoticePriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum NoticeTargetScope {
  ALL = 'ALL',
  STUDENTS = 'STUDENTS',
  FACULTY = 'FACULTY',
  DEPARTMENT = 'DEPARTMENT',
  PROGRAM = 'PROGRAM',
  CUSTOM = 'CUSTOM',
}

export enum NoticeStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  REJECTED = 'REJECTED',
  SCHEDULED = 'SCHEDULED',
  PUBLISHED = 'PUBLISHED',
  EXPIRED = 'EXPIRED',
  WITHDRAWN = 'WITHDRAWN',
  ARCHIVED = 'ARCHIVED',
}

export class CreateNoticeDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsString()
  aiSummary?: string;

  @IsOptional()
  @IsEnum(NoticeCategory)
  category?: NoticeCategory;

  @IsOptional()
  @IsEnum(NoticePriority)
  priority?: NoticePriority;

  @IsOptional()
  @IsEnum(NoticeTargetScope)
  targetScope?: NoticeTargetScope;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  programId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  targetYear?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  targetSemester?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => TargetAudienceDto)
  targetAudience?: TargetAudienceDto;

  @IsOptional()
  @IsBoolean()
  requiresAcknowledgement?: boolean;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsDateString()
  publishAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsEnum(NoticeStatus)
  @IsIn([
    NoticeStatus.DRAFT,
    NoticeStatus.PENDING_REVIEW,
    NoticeStatus.SCHEDULED,
    NoticeStatus.PUBLISHED,
  ])
  status?: NoticeStatus;
}
