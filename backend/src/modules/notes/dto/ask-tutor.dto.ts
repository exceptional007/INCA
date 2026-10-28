import { IsString, IsNotEmpty, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class AskTutorDto {
  @IsUUID()
  @IsOptional()
  conversationId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Question cannot be empty' })
  @MaxLength(2000, { message: 'Question cannot exceed 2000 characters' })
  question: string;
}

