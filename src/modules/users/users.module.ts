import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UploadModule } from '@/modules/upload/upload.module';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  imports: [UploadModule],
})
export class UsersModule {}