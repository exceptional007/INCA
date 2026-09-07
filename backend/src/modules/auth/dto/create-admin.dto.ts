import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateAdminDto {
  @ApiProperty({ example: 'Dr. Ramesh Sarma' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'ramesh.sarma@bit.ac.in' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: 'faed3e96-4166-4a8d-86ac-25b800c33377',
    description: 'Active Department UUID (mandatory)',
  })
  @IsUUID()
  @IsNotEmpty({ message: 'departmentId is required' })
  departmentId!: string;

  @ApiPropertyOptional({ example: 'Admin@123', description: 'Initial password' })
  @IsString()
  @IsOptional()
  @MinLength(8)
  password?: string;
}
