import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(6, {
    message: 'A senha atual deve ter no mínimo 6 caracteres.',
  })
  currentPassword!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, {
    message: 'A nova senha deve ter no mínimo 8 caracteres.',
  })
  newPassword!: string;
}