import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsArray, IsNumber } from 'class-validator';

export class CreateDraftSlotDto {
  @IsString()
  @IsNotEmpty()
  gridId: string;

  @IsString()
  @IsNotEmpty()
  day: string;

  @IsString()
  @IsNotEmpty()
  timeSlotStart: string;

  @IsString()
  @IsNotEmpty()
  timeSlotEnd: string;

  @IsBoolean()
  @IsOptional()
  isMergedSlot?: boolean;

  @IsString()
  @IsOptional()
  mergedTimeSlotEnd?: string | null;

  @IsArray()
  @IsString({ each: true })
  sectionCodes: string[];

  @IsString()
  @IsNotEmpty()
  subjectRaw: string;

  @IsString()
  @IsNotEmpty()
  facultyRaw: string;

  @IsString()
  @IsNotEmpty()
  room: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsOptional()
  rawCellText?: string;

  @IsString()
  @IsOptional()
  matchedSubjectId?: string | null;

  @IsString()
  @IsOptional()
  matchedFacultyId?: string | null;

  @IsString()
  @IsOptional()
  matchedRoomId?: string | null;

  @IsString()
  @IsOptional()
  matchedSectionId?: string | null;

  @IsNumber()
  @IsOptional()
  matchConfidence?: number;
}
