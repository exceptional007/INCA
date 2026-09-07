import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsNumber } from 'class-validator';

export class CreateActiveSlotDto {
  @IsString()
  @IsNotEmpty()
  day: string;

  @IsNumber()
  @IsOptional()
  lectureNumber?: number;

  @IsString()
  @IsNotEmpty()
  timeSlotStart: string;

  @IsString()
  @IsNotEmpty()
  timeSlotEnd: string;

  @IsString()
  @IsNotEmpty()
  subjectName: string;

  @IsString()
  @IsOptional()
  subjectCode?: string;

  @IsString()
  @IsNotEmpty()
  facultyName: string;

  @IsString()
  @IsNotEmpty()
  room: string;

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
