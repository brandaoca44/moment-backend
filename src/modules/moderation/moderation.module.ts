import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ModerationService } from './moderation.service';

@Module({
  imports: [ConfigModule],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}