import { IsArray, IsOptional, IsString, IsNumber } from 'class-validator';

export class TargetAudienceDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[]; // e.g. ['STUDENT'], ['FACULTY'], or ['STUDENT', 'FACULTY']

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departmentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  programIds?: string[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  targetYears?: number[]; // e.g. [1, 2, 3, 4]

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  targetSemesters?: number[]; // e.g. [1, 2, 3, 4, 5, 6, 7, 8]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectionIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[]; // specific individual users if authorized
}

