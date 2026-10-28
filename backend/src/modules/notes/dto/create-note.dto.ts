import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID, IsArray, IsInt, Min, Max, ValidateIf, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';
import { NoteSourceType, NoteStatus } from '@prisma/client';

export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsNotEmpty()
  subjectId: string;

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
  @IsNotEmpty()
  programIds: string[];

  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(1)
  @Max(8)
  @IsOptional()
  semesterNumber?: number;

  @IsEnum(NoteSourceType)
  @IsOptional()
  sourceType?: NoteSourceType = NoteSourceType.FILE;

  @ValidateIf((o) => o.sourceType === NoteSourceType.DRIVE)
  @IsString()
  @IsNotEmpty({ message: 'Google Drive URL is required when source type is DRIVE' })
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

