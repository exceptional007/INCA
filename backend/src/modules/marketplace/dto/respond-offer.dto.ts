import { IsEnum, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum OfferAction {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
  COUNTER = 'COUNTER',
  CANCEL = 'CANCEL',
}

export class RespondOfferDto {
  @IsEnum(OfferAction)
  @IsNotEmpty()
  action: OfferAction;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  counterAmount?: number;
}

