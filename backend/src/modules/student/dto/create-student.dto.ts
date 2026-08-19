import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Gender } from '@prisma/client';

export class CreateStudentDto {
  @ApiProperty({
    example: 'uuid-of-user',
    description: 'User ID associated with the student',
  })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

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
    description: 'Student first name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiPropertyOptional({
    example: 'Srivastava',
    description: 'Student last name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({
    enum: Gender,
    example: Gender.MALE,
    description: 'Student gender',
  })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiPropertyOptional({
    example: '2005-08-15',
    description: 'Student date of birth',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    example: '9876543210',
    description: 'Student phone number',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    example: 'students/uuid/profile.jpg',
    description: 'Storage key for student profile photo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  photoKey?: string;
}
