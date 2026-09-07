import { IsOptional, IsString } from 'class-validator';

export class ApproveBatchDto {
  @IsString()
  @IsOptional()
  programId?: string;
}
