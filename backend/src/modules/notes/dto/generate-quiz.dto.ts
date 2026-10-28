import { IsString, IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class GenerateQuizDto {
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 5))
  @IsInt()
  @Min(3)
  @Max(15)
  @IsOptional()
  questionCount?: number = 5;

  @IsString()
  @IsIn(['EASY', 'MEDIUM', 'HARD'])
  @IsOptional()
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD' = 'MEDIUM';

  @IsString()
  @IsIn(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'MIXED'])
  @IsOptional()
  questionType?: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MIXED' = 'MULTIPLE_CHOICE';

  @IsString()
  @IsOptional()
  topic?: string;
}

