import { Module } from '@nestjs/common';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { ModerationModule } from '@/modules/moderation/moderation.module';
import { UploadModule } from '@/modules/upload/upload.module';

@Module({
  imports: [ModerationModule, UploadModule],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}