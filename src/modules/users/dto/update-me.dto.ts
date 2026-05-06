import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateMeDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username deve conter apenas letras, números e underscore.',
  })
  username?: string;
}