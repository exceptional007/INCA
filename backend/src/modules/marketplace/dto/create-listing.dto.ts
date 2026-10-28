import { IsString, IsNotEmpty, IsNumber, IsOptional, IsEnum, Min, MaxLength, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { MarketplaceCategory, ProductCondition, ListingVisibility } from '@prisma/client';

export class CreateListingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  description: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  price: number;

  @IsEnum(MarketplaceCategory)
  category: MarketplaceCategory;

  @IsEnum(ProductCondition)
  condition: ProductCondition;

  @IsOptional()
  @IsEnum(ListingVisibility)
  visibility?: ListingVisibility = ListingVisibility.ALL;

  @IsOptional()
  @IsBoolean()
  isNegotiable?: boolean = true;

  @IsOptional()
  @IsString()
  pickupLocation?: string;

  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}

