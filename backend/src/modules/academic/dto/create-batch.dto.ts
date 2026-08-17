import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBatchDto {
  @ApiProperty({
    example: 'uuid-of-ds-program',
    description: 'Program ID to which the batch belongs',
  })
  @IsUUID()
  @IsNotEmpty()
  programId!: string;

  @ApiProperty({
    example: '2023-2027',
    description: 'Batch display name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  name!: string;

  @ApiProperty({
    example: 2023,
    description: 'Batch starting year',
  })
  @IsInt()
  @Min(2000)
  startYear!: number;

  @ApiProperty({
    example: 2027,
    description: 'Batch ending year',
  })
  @IsInt()
  @Min(2000)
  endYear!: number;
}
