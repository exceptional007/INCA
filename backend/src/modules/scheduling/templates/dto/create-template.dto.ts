import { IsString, IsNotEmpty, IsUUID, IsInt, Min, Max, IsDateString, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTemplateDto {
  @ApiProperty({ description: 'The UUID of the section.' })
  @IsUUID()
  @IsNotEmpty()
  sectionId: string;

  @ApiProperty({ description: 'The UUID of the subject.' })
  @IsUUID()
  @IsNotEmpty()
  subjectId: string;

  @ApiProperty({ description: 'The UUID of the faculty.' })
  @IsUUID()
  @IsNotEmpty()
  facultyId: string;

  @ApiProperty({ description: 'The UUID of the room.' })
  @IsUUID()
  @IsNotEmpty()
  roomId: string;

  @ApiProperty({ description: 'Day of the week (1=Monday, 7=Sunday).', minimum: 1, maximum: 7 })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @ApiProperty({ description: 'Start time in HH:mm format.', example: '09:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'startTime must be in HH:mm format' })
  startTime: string;

  @ApiProperty({ description: 'End time in HH:mm format.', example: '10:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'endTime must be in HH:mm format' })
  endTime: string;

  @ApiProperty({ description: 'The date from which this template is effective (YYYY-MM-DD).' })
  @IsDateString()
  @IsNotEmpty()
  effectiveFrom: string;

  @ApiPropertyOptional({ description: 'The date until which this template is effective (YYYY-MM-DD).' })
  @IsDateString()
  @IsOptional()
  effectiveTo?: string;
}
