import { IsEmail, IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(120)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 64)
  password!: string;
}