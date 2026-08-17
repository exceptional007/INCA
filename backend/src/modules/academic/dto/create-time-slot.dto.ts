import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateTimeSlotDto {
  @ApiProperty({
    example: '09:00 - 10:00',
    description: 'Time slot display name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @ApiProperty({
    example: '09:00',
    description: 'Start time in HH:mm format',
  })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime!: string;

  @ApiProperty({
    example: '10:00',
    description: 'End time in HH:mm format',
  })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  endTime!: string;
}
