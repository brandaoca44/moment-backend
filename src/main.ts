import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

function parseAllowedOrigins(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 🔥 importante pra Railway (proxy)
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cookieParser());
  app.use(compression());

  // 🔐 CORS pronto pra frontend
  const allowedOrigins = parseAllowedOrigins(process.env.APP_URL);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin não permitida: ${origin}`), false);
    },
    credentials: true,
  });

  // 🧪 Validação global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 📦 Interceptor + filter
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // 🔗 prefixo global
  app.setGlobalPrefix('api');

  // 📘 Swagger
  const config = new DocumentBuilder()
    .setTitle('Moment API')
    .setDescription('API da rede social Moment')
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT) || 3333;
  await app.listen(port);

  console.log(`🚀 Moment API rodando na porta ${port}`);
}

bootstrap();