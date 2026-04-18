import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TCurrentUser } from '@/modules/auth/types/current-user.type';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';

@ApiTags('Notifications')
@ApiCookieAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @ApiOperation({ summary: 'Listar notificações do usuário autenticado' })
  @ApiResponse({
    status: 200,
    description: 'Notificações retornadas com sucesso.',
  })
  @ApiResponse({
    status: 401,
    description: 'Usuário não autenticado.',
  })
  @Get()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  findMine(
    @CurrentUser() user: TCurrentUser,
    @Query() query: GetNotificationsQueryDto,
  ) {
    return this.notificationsService.findMine(user, query.limit);
  }

  @ApiOperation({ summary: 'Marcar todas as notificações como lidas' })
  @ApiResponse({
    status: 200,
    description: 'Notificações marcadas como lidas.',
  })
  @ApiResponse({
    status: 401,
    description: 'Usuário não autenticado.',
  })
  @Patch('read-all')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  markAllAsRead(@CurrentUser() user: TCurrentUser) {
    return this.notificationsService.markAllAsRead(user);
  }

  @ApiOperation({ summary: 'Marcar uma notificação como lida' })
  @ApiResponse({
    status: 200,
    description: 'Notificação marcada como lida.',
  })
  @ApiResponse({
    status: 401,
    description: 'Usuário não autenticado.',
  })
  @ApiResponse({
    status: 403,
    description: 'Usuário não autorizado a alterar esta notificação.',
  })
  @ApiResponse({
    status: 404,
    description: 'Notificação não encontrada.',
  })
  @Patch(':id/read')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.notificationsService.markAsRead(id, user);
  }
}