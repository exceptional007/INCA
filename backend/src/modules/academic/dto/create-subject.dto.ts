import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty({
    example: 1,
    description: 'Academic year (1: 1st Year, 2: 2nd Year, 3: 3rd Year, 4: 4th Year)',
  })
  @IsInt()
  @Min(1)
  @Max(4)
  year!: number;

  @ApiProperty({
    example: 'uuid-of-semester-1',
    description: 'Semester ID',
  })
  @IsUUID()
  @IsNotEmpty()
  semesterId!: string;

  @ApiProperty({
    example: 'CS101',
    description: 'Unique subject code',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @ApiProperty({
    example: 'Compiler Design',
    description: 'Subject name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({
    example: false,
    description: 'Whether this subject is a laboratory subject',
  })
  @IsBoolean()
  isLab!: boolean;
}