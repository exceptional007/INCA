import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'Autumn Semester 2026' })
  @IsString()
  @IsOptional()
  academicPeriod?: string;

  @ApiPropertyOptional({ example: 75 })
  @IsInt()
  @Min(50)
  @Max(100)
  @IsOptional()
  minAttendance?: number;

  @ApiPropertyOptional({ example: 24 })
  @IsInt()
  @Min(1)
  @Max(168)
  @IsOptional()
  editWindow?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  allowFacultyOverride?: boolean;
}
