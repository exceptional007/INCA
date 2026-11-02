import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Matches, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'admin@bit.ac.in',
    description: 'Official BIT email address',
  })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(254)
  @Matches(/^[a-zA-Z0-9._%+-]+@bit\.ac\.in$/, {
    message: 'Only official BIT email addresses are allowed.',
  })
  email!: string;

  @ApiProperty({
    example: 'Admin@123',
    description: 'User Password',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(256)
  password!: string;
}
