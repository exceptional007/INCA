import { IsString, IsNotEmpty, IsUUID, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { ScheduleStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiProperty({ description: 'The UUID of the template.' })
  @IsUUID()
  @IsNotEmpty()
  templateId: string;

  @ApiProperty({ description: 'The date of the lecture (YYYY-MM-DD).' })
  @IsDateString()
  @IsNotEmpty()
  lectureDate: string;

  @ApiPropertyOptional({ enum: ScheduleStatus, default: ScheduleStatus.SCHEDULED })
  @IsEnum(ScheduleStatus)
  @IsOptional()
  status?: ScheduleStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  remarks?: string;
}
