import { IsString, IsOptional, IsEnum, IsUUID, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { NoteSourceType, NoteStatus } from '@prisma/client';

export class QueryNotesDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsUUID()
  @IsOptional()
  subjectId?: string;

  @IsUUID()
  @IsOptional()
  programId?: string;

  @Transform(({ value }) => (value !== undefined && value !== '' ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(1)
  @IsOptional()
  semesterNumber?: number;

  @IsEnum(NoteSourceType)
  @IsOptional()
  sourceType?: NoteSourceType;

  @IsEnum(NoteStatus)
  @IsOptional()
  status?: NoteStatus;

  @Transform(({ value }) => (value !== undefined && value !== '' ? parseInt(value, 10) : 1))
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Transform(({ value }) => (value !== undefined && value !== '' ? parseInt(value, 10) : 12))
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 12;

  @IsString()
  @IsOptional()
  sortBy?: 'createdAt' | 'title' = 'createdAt';

  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

