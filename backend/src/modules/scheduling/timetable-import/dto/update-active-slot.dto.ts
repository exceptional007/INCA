import { IsString, IsBoolean, IsOptional, IsNumber } from 'class-validator';

export class UpdateActiveSlotDto {
  @IsString()
  @IsOptional()
  day?: string;

  @IsNumber()
  @IsOptional()
  lectureNumber?: number;

  @IsString()
  @IsOptional()
  timeSlotStart?: string;

  @IsString()
  @IsOptional()
  timeSlotEnd?: string;

  @IsString()
  @IsOptional()
  subjectName?: string;

  @IsString()
  @IsOptional()
  subjectCode?: string;

  @IsString()
  @IsOptional()
  facultyName?: string;

  @IsString()
  @IsOptional()
  room?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsBoolean()
  @IsOptional()
  isLab?: boolean;

  @IsString()
  @IsOptional()
  batchSection?: string;
}
