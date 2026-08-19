import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches
} from 'class-validator';
import { Gender } from '@prisma/client';

export class CreateStudentAccountDto {
  @ApiProperty({
    example: 'admin@bit.ac.in',
    description: 'Official BIT email address',
  })
  @IsNotEmpty()
  @IsEmail()
  @Matches(/^[a-zA-Z0-9._%+-]+@bit\.ac\.in$/, {
    message: 'Only official BIT email addresses are allowed.',
  })
  email!: string;

  @ApiProperty({
    example: 'Temp@12345',
    description: 'Initial login password',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    example: 'BIT-23/DS/C/08',
    description: 'Unique college-issued student ID',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  collegeId!: string;

  @ApiProperty({
    example: '08',
    description: 'Unique student roll number',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  rollNumber!: string;

  @ApiProperty({
    example: 'BITDS2023008',
    description: 'Unique enrollment number',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  enrollmentNumber!: string;

  @ApiProperty({
    example: 'Akshhat',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiPropertyOptional({
    example: 'Srivastava',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({
    enum: Gender,
    example: Gender.MALE,
  })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiPropertyOptional({
    example: '2005-08-15',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    example: '9876543210',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    example: 'students/profile.jpg',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  photoKey?: string;
}
