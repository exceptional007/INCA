import { IsEnum, IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EditRecordDto {
  @ApiProperty({
    enum: AttendanceStatus,
    description: 'The corrected attendance status.',
  })
  @IsEnum(AttendanceStatus)
  newStatus: AttendanceStatus;

  @ApiProperty({
    description: 'UUID of the user making this edit (required for audit trail).',
  })
  @IsUUID()
  @IsNotEmpty()
  editedById: string;

  @ApiPropertyOptional({
    description: 'Reason for the correction (recommended for accountability).',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
