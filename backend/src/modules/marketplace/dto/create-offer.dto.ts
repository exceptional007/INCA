import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOfferDto {
  @IsString()
  @IsNotEmpty()
  listingId: string;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  amount: number;
}

