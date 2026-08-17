import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({
    example: 'CSE',
    description: 'Unique department code',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @ApiProperty({
    example: 'Computer Science and Engineering',
    description: 'Department name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string | undefined;

  @ApiPropertyOptional({
    example: 'CSE',
    description: 'Short department name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  shortName?: string;

  @ApiPropertyOptional({
    example: 'Department of Computer Science and Engineering',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}