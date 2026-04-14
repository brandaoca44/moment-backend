import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message:
      'Username deve conter apenas letras, números, ponto e underscore.',
  })
  username!: string;

  @IsEmail()
  @MaxLength(120)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 64)
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 0,
    },
    {
      message:
        'A senha deve ter no mínimo 8 caracteres, com letra maiúscula, minúscula e número.',
    },
  )
  password!: string;
}