import {
  IsUUID,
  IsOptional,
  IsNotEmpty,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class CreateSessionDto {
  @ApiPropertyOptional({
    description:
      'UUID of the Schedule this session is for. Provide either scheduleId OR activityId — not both.',
  })
  @IsUUID()
  @IsOptional()
  scheduleId?: string;

  @ApiPropertyOptional({
    description:
      'UUID of the Activity this session is for. Provide either scheduleId OR activityId — not both.',
  })
  @IsUUID()
  @IsOptional()
  activityId?: string;

  @ApiPropertyOptional({ description: 'Deprecated compatibility field. Recording faculty is derived from the authenticated user.' })
  @IsUUID()
  @IsOptional()
  takenById?: string;

  @ApiProperty({
    description: 'Date on which attendance is being taken (YYYY-MM-DD).',
    example: '2026-08-22',
  })
  @IsDateString()
  @IsNotEmpty()
  attendanceDate: string;
}
