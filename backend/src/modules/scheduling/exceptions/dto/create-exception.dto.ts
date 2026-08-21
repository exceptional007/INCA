import { IsString, IsNotEmpty, IsUUID, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExceptionDto {
  @ApiProperty({ description: 'The UUID of the schedule.' })
  @IsUUID()
  @IsNotEmpty()
  scheduleId: string;

  @ApiProperty({ description: 'Type of exception (e.g. CANCELLATION, ROOM_CHANGE, FACULTY_CHANGE).' })
  @IsString()
  @IsNotEmpty()
  exceptionType: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  newFacultyId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  newRoomId?: string;

  @ApiPropertyOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'newStartTime must be in HH:mm format' })
  @IsOptional()
  newStartTime?: string;

  @ApiPropertyOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'newEndTime must be in HH:mm format' })
  @IsOptional()
  newEndTime?: string;
}
