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
  mergedTimeSlotEnd?: string;

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
}
