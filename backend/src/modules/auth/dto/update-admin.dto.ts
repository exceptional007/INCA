import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateAdminDto {
  @ApiPropertyOptional({ example: 'Dr. Ramesh Sarma' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'ramesh.sarma@bit.ac.in' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    example: 'faed3e96-4166-4a8d-86ac-25b800c33377',
    description: 'Active Department UUID (optional on edit, but validated if provided)',
  })
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
