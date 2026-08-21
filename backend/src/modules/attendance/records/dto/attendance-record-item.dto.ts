import { IsEnum, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttendanceRecordItemDto {
  @ApiProperty({ description: 'UUID of the student.' })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({ enum: AttendanceStatus, description: 'Attendance status for this student.' })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @ApiPropertyOptional({ description: 'Optional remarks (e.g. reason for being late).' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
