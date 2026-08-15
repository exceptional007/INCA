import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAcademicSessionDto {
  @ApiProperty({
    example: '2026-27',
    description: 'Academic session name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  name!: string;

  @ApiProperty({
    example: '2026-07-01',
    description: 'Session start date',
  })
  @IsDateString()
  startDate!: string;

  @ApiProperty({
    example: '2027-06-30',
    description: 'Session end date',
  })
  @IsDateString()
  endDate!: string;
}