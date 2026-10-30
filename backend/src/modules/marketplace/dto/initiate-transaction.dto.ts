import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class InitiateTransactionDto {
  @IsString()
  @IsNotEmpty()
  listingId: string;

  @IsOptional()
  @IsString()
  offerId?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  time?: string;
}

