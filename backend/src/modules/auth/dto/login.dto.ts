import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  @IsEmail()
  @Matches(/^[a-zA-Z0-9._%+-]+@bit\.ac\.in$/, {
    message: 'Only official BIT email addresses are allowed.',
  })
  email!: string;

  @IsNotEmpty()
  password!: string;
}