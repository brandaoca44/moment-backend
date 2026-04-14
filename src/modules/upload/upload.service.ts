import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.getOrThrow<string>('R2_BUCKET_NAME');
    this.publicUrl = this.configService
      .getOrThrow<string>('R2_PUBLIC_URL')
      .replace(/\/+$/, '');

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${this.configService.getOrThrow<string>(
        'R2_ACCOUNT_ID',
      )}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>(
          'R2_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: 'posts' | 'avatars',
    userId: string,
  ): Promise<string> {
    if (!userId.trim()) {
      throw new BadRequestException('Usuário inválido para upload.');
    }

    if (!file?.buffer) {
      throw new BadRequestException('Arquivo inválido.');
    }

    const processed = await this.processImage(file, folder);
    const key = `${folder}/${userId}/${randomUUID()}.webp`;

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: processed.buffer,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } catch (error) {
      this.logger.error(
        'Erro ao fazer upload para o R2.',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Erro ao fazer upload da imagem.');
    }

    return `${this.publicUrl}/${key}`;
  }

  async deleteImage(url: string): Promise<void> {
    if (!url.startsWith(`${this.publicUrl}/`)) {
      return;
    }

    const key = url.replace(`${this.publicUrl}/`, '');

    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      this.logger.error(
        'Erro ao deletar imagem do R2.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async processImage(
    file: Express.Multer.File,
    folder: 'posts' | 'avatars',
  ): Promise<{ buffer: Buffer }> {
    try {
      let pipeline = sharp(file.buffer, {
        failOn: 'warning',
      }).autoOrient();

      if (folder === 'avatars') {
        pipeline = pipeline.resize(512, 512, {
          fit: 'cover',
          position: 'centre',
        });
      } else {
        pipeline = pipeline.resize({
          width: 1440,
          height: 1440,
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      const buffer = await pipeline
        .webp({
          quality: folder === 'avatars' ? 82 : 80,
        })
        .toBuffer();

      return { buffer };
    } catch (error) {
      this.logger.error(
        'Erro ao processar imagem com Sharp.',
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Não foi possível processar a imagem.');
    }
  }
}