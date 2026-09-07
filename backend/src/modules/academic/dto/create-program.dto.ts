import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProgramDto {
  @ApiProperty({
    example: 'uuid-of-cse-department',
    description: 'Department ID to which the program belongs',
  })
  @IsUUID()
  @IsNotEmpty()
  departmentId!: string;

  @ApiProperty({
    example: 'DS',
    description: 'Unique program code',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @ApiProperty({
    example: 'Data Science',
    description: 'Program name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({
    example: 'DS',
    description: 'Short program name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  shortName?: string;

  @ApiPropertyOptional({
    example: 4,
    default: 4,
    description: 'Program duration in years',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  durationYears?: number;
}
