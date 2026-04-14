import { IsNotEmpty, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateAvatarDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  @IsUrl({}, { message: 'url deve ser uma URL válida.' })
  url!: string;
}