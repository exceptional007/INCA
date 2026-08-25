import { IsString, IsBoolean, IsOptional, IsArray, IsNumber } from 'class-validator';

export class UpdateDraftSlotDto {
  @IsString()
  @IsOptional()
  day?: string;

  @IsString()
  @IsOptional()
  timeSlotStart?: string;

  @IsString()
  @IsOptional()
  timeSlotEnd?: string;

  @IsBoolean()
  @IsOptional()
  isMergedSlot?: boolean;

  @IsString()
  @IsOptional()
  mergedTimeSlotEnd?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sectionCodes?: string[];

  @IsString()
  @IsOptional()
  subjectRaw?: string;

  @IsString()
  @IsOptional()
  facultyRaw?: string;

  @IsString()
  @IsOptional()
  room?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  matchedSubjectId?: string;

  @IsString()
  @IsOptional()
  matchedFacultyId?: string;

  @IsString()
  @IsOptional()
  matchedRoomId?: string;

  @IsString()
  @IsOptional()
  matchedSectionId?: string;

  @IsNumber()
  @IsOptional()
  matchConfidence?: number;

  @IsBoolean()
  @IsOptional()
  adminEdited?: boolean;
}
