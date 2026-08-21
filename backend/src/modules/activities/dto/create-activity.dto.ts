import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateActivityDto {
  @ApiProperty({ description: 'UUID of the activity type.' })
  @IsUUID()
  @IsNotEmpty()
  activityTypeId: string;

  @ApiProperty({ description: 'Title of the activity.' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Optional description or agenda.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'UUID of the faculty organising this activity.' })
  @IsUUID()
  @IsNotEmpty()
  facultyId: string;

  @ApiPropertyOptional({ description: 'UUID of the room where the activity is held (optional for online events).' })
  @IsUUID()
  @IsOptional()
  roomId?: string;

  @ApiProperty({ description: 'ISO datetime when the activity starts.', example: '2026-08-22T09:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({ description: 'ISO datetime when the activity ends.', example: '2026-08-22T11:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @ApiPropertyOptional({ description: 'Whether attendance is mandatory for this activity.', default: true })
  @IsBoolean()
  @IsOptional()
  attendanceRequired?: boolean;
}
