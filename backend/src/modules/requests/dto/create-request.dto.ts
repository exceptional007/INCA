import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRequestDto {
  @ApiProperty({ description: 'Title or subject of the request' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Detailed justification or context' })
  @IsString()
  @IsNotEmpty()
  details: string;

  @ApiProperty({ description: 'Name or email of the requesting individual' })
  @IsString()
  @IsNotEmpty()
  requester: string;
}
