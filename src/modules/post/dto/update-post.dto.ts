import { IsOptional, IsString, Length } from 'class-validator';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @Length(1, 220)
  content?: string;
}