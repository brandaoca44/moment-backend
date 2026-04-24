import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { UploadModule } from '@/modules/upload/upload.module';
import { BlockModule } from '@/modules/block/block.module';

@Module({
  imports: [PrismaModule, UploadModule, BlockModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}