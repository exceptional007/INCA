import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class ConfirmScheduleDto {
  @IsString()
  @IsNotEmpty({ message: 'Meeting location is required' })
  @MaxLength(120)
  location: string;

  @IsString()
  @IsNotEmpty({ message: 'Meeting date is required' })
  @MaxLength(50)
  date: string;

  @IsString()
  @IsNotEmpty({ message: 'Meeting time is required' })
  @MaxLength(50)
  time: string;
}

