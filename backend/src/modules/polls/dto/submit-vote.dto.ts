import { IsArray, ArrayMinSize, IsString, IsNotEmpty } from 'class-validator';

export class SubmitVoteDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one option must be selected' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  optionIds: string[];
}

