import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '@/prisma/prisma.service';

type RegisterInput = {
  name: string;
  username: string;
  email: string;
  password: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(data: RegisterInput) {
    const email = data.email.trim().toLowerCase();
    const username = data.username.trim().toLowerCase();

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
      select: {
        id: true,
        email: true,
        username: true,
      },
    });

    if (existingUser) {
      throw new BadRequestException('E-mail ou username já está em uso.');
    }

    const passwordHash = await argon2.hash(data.password);

    const user = await this.prisma.user.create({
      data: {
        name: data.name.trim(),
        username,
        email,
        password: passwordHash,
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        avatar: true,
        createdAt: true,
      },
    });

    const { accessToken, refreshToken } = await this.generateTokens(user.id);

    // Salva o hash do refresh token no banco
    await this.saveRefreshToken(user.id, refreshToken);

    return { user, accessToken, refreshToken };
  }

  async validateUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await this.prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new UnauthorizedException('Credenciais inválidas.');
  }

  const passwordIsValid = await argon2.verify(user.password, password);

  if (!passwordIsValid) {
    throw new UnauthorizedException('Credenciais inválidas.');
  }

  return user;
}

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);

    const { accessToken, refreshToken } = await this.generateTokens(user.id);

    await this.saveRefreshToken(user.id, refreshToken);

    return {
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, refreshTokenHash: true },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const tokenIsValid = await argon2.verify(
      user.refreshTokenHash,
      refreshToken,
    );

    if (!tokenIsValid) {
      // Possível roubo de token — invalida tudo
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshTokenHash: null },
      });
      throw new UnauthorizedException('Sessão inválida. Faça login novamente.');
    }

    const tokens = await this.generateTokens(userId);
    await this.saveRefreshToken(userId, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  // ─── Privados ────────────────────────────────────────────────

  private async generateTokens(userId: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId },
        {
          secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
          expiresIn: this.configService.get<string>(
            'JWT_ACCESS_EXPIRES_IN',
            '15m',
          ),
        },
      ),
      this.jwtService.signAsync(
        { sub: userId },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get<string>(
            'JWT_REFRESH_EXPIRES_IN',
            '7d',
          ),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, refreshToken: string) {
    const hash = await argon2.hash(refreshToken);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hash },
    });
  }
}