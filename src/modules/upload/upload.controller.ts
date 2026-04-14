import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TCurrentUser } from '@/modules/auth/types/current-user.type';
import { UploadService } from './upload.service';

const imageInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
      return callback(
        new BadRequestException(
          'Apenas imagens JPG, JPEG, PNG ou WEBP são permitidas.',
        ),
        false,
      );
    }
    callback(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('post-image')
  @UseInterceptors(imageInterceptor)
  async uploadPostImage(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: TCurrentUser,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo não enviado.');
    }

    const url = await this.uploadService.uploadImage(file, 'posts', user.id);
    return { url };
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('avatar')
  @UseInterceptors(imageInterceptor)
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: TCurrentUser,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo não enviado.');
    }

    const url = await this.uploadService.uploadImage(file, 'avatars', user.id);
    return { url };
  }
}