import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum PollTabFilter {
  ALL = 'ALL',
  ACTIVE = 'ACTIVE',
  MY_POLLS = 'MY_POLLS',
  PARTICIPATED = 'PARTICIPATED',
  CLOSED = 'CLOSED',
}

export class QueryPollsDto {
  @IsOptional()
  @IsEnum(PollTabFilter)
  tab?: PollTabFilter = PollTabFilter.ALL;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

