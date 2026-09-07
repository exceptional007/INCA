import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSectionDto {

  @ApiProperty({
    example: 'uuid-of-semester-7',
    description: 'Semester ID',
  })
  @IsUUID()
  @IsNotEmpty()
  semesterId!: string;

  @ApiProperty({
    example: 'A',
    description: 'Section name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  name!: string;
}
