import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';

export class UpdateRequestStatusDto {
  @ApiProperty({ enum: RequestStatus, description: 'New status for the request' })
  @IsEnum(RequestStatus)
  @IsNotEmpty()
  status: RequestStatus;
}
