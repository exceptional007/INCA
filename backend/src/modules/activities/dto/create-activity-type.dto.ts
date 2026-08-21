import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateActivityTypeDto {
  @ApiProperty({ description: 'Name of the activity type (e.g. Guest Lecture, Workshop).' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Optional description of this activity type.' })
  @IsString()
  @IsOptional()
  description?: string;
}
