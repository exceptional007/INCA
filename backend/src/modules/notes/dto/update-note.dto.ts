import { IsString, IsOptional, IsEnum, IsUUID, IsArray, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { NoteStatus } from '@prisma/client';

export class UpdateNoteDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  subjectId?: string;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [value];
      } catch {
        return value.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
    return value;
  })
  @IsArray()
  @IsOptional()
  programIds?: string[];

  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(1)
  @Max(8)
  @IsOptional()
  semesterNumber?: number;

  @IsString()
  @IsOptional()
  driveUrl?: string;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [value];
      } catch {
        return value.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
    return value;
  })
  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsEnum(NoteStatus)
  @IsOptional()
  status?: NoteStatus;
}

