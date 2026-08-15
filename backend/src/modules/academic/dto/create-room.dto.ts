import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({
    example: 'CR-101',
    description: 'Unique room code',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @ApiProperty({
    example: 'Computer Room 101',
    description: 'Room name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    example: 'CSE Block',
    description: 'Building name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  building?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Floor number',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  floor?: number;

  @ApiPropertyOptional({
    example: 60,
    description: 'Maximum room capacity',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  capacity?: number;

  @ApiProperty({
    example: true,
    description: 'Whether this room is a laboratory',
  })
  @IsBoolean()
  isLab!: boolean;
}