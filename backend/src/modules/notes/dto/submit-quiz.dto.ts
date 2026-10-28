import { IsObject, IsNotEmpty } from 'class-validator';

export class SubmitQuizDto {
  @IsObject()
  @IsNotEmpty({ message: 'Answers object is required' })
  answers: Record<string, string>;
}

