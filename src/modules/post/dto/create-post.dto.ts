import { IsNotEmpty, IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 220)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl({}, { message: 'imageUrl deve ser uma URL válida.' })
  imageUrl?: string;
}