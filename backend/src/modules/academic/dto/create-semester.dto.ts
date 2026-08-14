import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSemesterDto {
  @ApiProperty({
    example: 'uuid-of-ds-program',
    description: 'Program ID',
  })
  @IsUUID()
  @IsNotEmpty()
  programId!: string;

  @ApiProperty({
    example: 'uuid-of-2023-2027-batch',
    description: 'Batch ID',
  })
  @IsUUID()
  @IsNotEmpty()
  batchId!: string;

  @ApiProperty({
    example: 7,
    description: 'Semester number',
  })
  @IsInt()
  @Min(1)
  @Max(8)
  number!: number;

  @ApiProperty({
    example: 'Semester 7',
    description: 'Semester display name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;
}