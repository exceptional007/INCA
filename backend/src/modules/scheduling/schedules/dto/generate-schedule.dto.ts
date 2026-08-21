import { IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateScheduleDto {
  @ApiProperty({ description: 'Start date of the generation period (YYYY-MM-DD).' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ description: 'End date of the generation period (YYYY-MM-DD).' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;
}
