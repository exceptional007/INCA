import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAdminDto {
  @ApiProperty({ example: 'Dr. Ramesh Sarma' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'ramesh.sarma@tu.edu' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Tezpur University' })
  @IsString()
  @IsNotEmpty()
  institution: string;
}
