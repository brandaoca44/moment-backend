import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TCurrentUser } from './types/current-user.type';

const isProduction = process.env.NODE_ENV === 'production';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ('none' as const) : ('lax' as const),
  maxAge: 1000 * 60 * 15,
  path: '/',
};

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ('none' as const) : ('lax' as const),
  maxAge: 1000 * 60 * 60 * 24 * 7,
  path: '/api/auth/refresh',
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @ApiCookieAuth()
  @ApiOperation({ summary: 'Retorna o usuário autenticado' })
  @ApiResponse({
    status: 200,
    description: 'Usuário autenticado retornado com sucesso.',
  })
  @ApiResponse({
    status: 401,
    description: 'Usuário não autenticado.',
  })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: TCurrentUser) {
    return { user };
  }

  @ApiOperation({ summary: 'Registra um novo usuário' })
  @ApiResponse({
    status: 201,
    description: 'Usuário registrado com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos ou usuário já existente.',
  })
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('register')
  async register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(body);

    res.cookie('access_token', result.accessToken, COOKIE_OPTIONS);
    res.cookie('refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    return { user: result.user };
  }

  @ApiOperation({ summary: 'Realiza login do usuário' })
  @ApiResponse({
    status: 200,
    description: 'Login realizado com sucesso.',
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciais inválidas.',
  })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body.email, body.password);

    res.cookie('access_token', result.accessToken, COOKIE_OPTIONS);
    res.cookie('refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    return { user: result.user };
  }

  @ApiOperation({ summary: 'Renova os tokens usando o refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Tokens renovados com sucesso.',
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token ausente, inválido ou expirado.',
  })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token ausente.');
    }

    let payload: { sub: string };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    const tokens = await this.authService.refreshTokens(
      payload.sub,
      refreshToken,
    );

    res.cookie('access_token', tokens.accessToken, COOKIE_OPTIONS);
    res.cookie('refresh_token', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

    return { message: 'Tokens renovados com sucesso.' };
  }

  @ApiOperation({ summary: 'Realiza logout do usuário' })
  @ApiResponse({
    status: 200,
    description: 'Logout realizado com sucesso.',
  })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;

    if (refreshToken) {
      try {
        const payload = await this.jwtService.verifyAsync<{ sub: string }>(
          refreshToken,
          {
            secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          },
        );

        await this.authService.logout(payload.sub);
      } catch {
        // Se o token estiver inválido/expirado, ainda limpamos os cookies.
      }
    }

    const clearOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ('none' as const) : ('lax' as const),
};

res.clearCookie('access_token', { ...clearOptions, path: '/' });
res.clearCookie('refresh_token', { ...clearOptions, path: '/api/auth/refresh' });

    return { message: 'Logout realizado com sucesso.' };
  }
}