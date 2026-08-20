import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Gender } from '@prisma/client';

export class CreateFacultyDto {
  @ApiProperty({
    example: 'uuid-of-user',
    description: 'User ID associated with the faculty member',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({
    example: 'FAC-2026-001',
    description: 'Unique faculty employee code',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  employeeCode!: string;

  @ApiProperty({
    example: 'Rahul',
    description: 'Faculty first name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiPropertyOptional({
    example: 'Sharma',
    description: 'Faculty last name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({
    enum: Gender,
    example: Gender.MALE,
    description: 'Faculty gender',
  })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiPropertyOptional({
    example: '1985-04-15',
    description: 'Faculty date of birth',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({
    example: 'Assistant Professor',
    description: 'Faculty designation',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  designation!: string;

  @ApiPropertyOptional({
    example: '9876543210',
    description: 'Faculty phone number',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    example: 'faculty/profile.jpg',
    description: 'Storage key for faculty profile photo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  photoKey?: string;
}
