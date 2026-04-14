import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TCurrentUser } from '@/modules/auth/types/current-user.type';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  findMine(
    @CurrentUser() user: TCurrentUser,
    @Query() query: GetNotificationsQueryDto,
  ) {
    return this.notificationsService.findMine(user, query.limit);
  }

  @Patch('read-all')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  markAllAsRead(@CurrentUser() user: TCurrentUser) {
    return this.notificationsService.markAllAsRead(user);
  }

  @Patch(':id/read')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.notificationsService.markAsRead(id, user);
  }
}