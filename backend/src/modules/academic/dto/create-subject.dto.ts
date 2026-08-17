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
    example: 'uuid-of-ds-program',
    description: 'Program ID',
  })
  @IsUUID()
  @IsNotEmpty()
  programId!: string;

  @ApiProperty({
    example: 'uuid-of-semester-7',
    description: 'Semester ID',
  })
  @IsUUID()
  @IsNotEmpty()
  semesterId!: string;

  @ApiProperty({
    example: 'DS701',
    description: 'Unique subject code',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @ApiProperty({
    example: 'Machine Learning',
    description: 'Subject name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({
    example: 4,
    description: 'Subject credits',
  })
  @IsInt()
  @Min(1)
  @Max(10)
  credits!: number;

  @ApiProperty({
    example: false,
    description: 'Whether this subject is a laboratory subject',
  })
  @IsBoolean()
  isLab!: boolean;
}