import { IsEnum, IsString, IsUUID, IsOptional } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EditRecordDto {
  @ApiProperty({
    enum: AttendanceStatus,
    description: 'The corrected attendance status.',
  })
  @IsEnum(AttendanceStatus)
  newStatus: AttendanceStatus;

  @ApiPropertyOptional({
    description: 'Deprecated compatibility field. Editor is derived from the authenticated user.',
  })
  @IsUUID()
  @IsOptional()
  editedById?: string;

  @ApiPropertyOptional({
    description: 'Reason for the correction (recommended for accountability).',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
