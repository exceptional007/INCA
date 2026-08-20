import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  Matches
} from 'class-validator';

export class CreateUserDto {
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
    description: 'Initial password',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    example: 'uuid-of-role',
    description: 'Role ID to assign to the new user',
  })
  @IsUUID()
  @IsNotEmpty()
  roleId!: string;
}
