import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { BlockModule } from '@/modules/block/block.module';

@Module({
  imports: [PrismaModule, BlockModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}