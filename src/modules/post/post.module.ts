import { Module } from '@nestjs/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { ModerationModule } from '@/modules/moderation/moderation.module';
import { UploadModule } from '@/modules/upload/upload.module';
import { BlockModule } from '@/modules/block/block.module';

@Module({
  imports: [
    PrismaModule,
    ModerationModule,
    UploadModule,
    BlockModule,
  ],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}