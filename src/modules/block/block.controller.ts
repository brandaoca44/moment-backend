import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TCurrentUser } from '@/modules/auth/types/current-user.type';
import { BlockService } from './block.service';

@ApiTags('block')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('block')
export class BlockController {
  constructor(private readonly blockService: BlockService) {}

  @Post(':userId')
  @ApiOperation({ summary: 'Bloquear usuário' })
  @ApiResponse({ status: 201, description: 'Usuário bloqueado.' })
  async block(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: TCurrentUser,
  ) {
    const data = await this.blockService.blockUser(userId, currentUser);

    return {
      success: true,
      data,
      message: 'Usuário bloqueado com sucesso.',
    };
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Desbloquear usuário' })
  @ApiResponse({ status: 200, description: 'Usuário desbloqueado.' })
  async unblock(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: TCurrentUser,
  ) {
    const data = await this.blockService.unblockUser(userId, currentUser);

    return {
      success: true,
      data,
      message: 'Usuário desbloqueado com sucesso.',
    };
  }

  @Get()
  @ApiOperation({ summary: 'Listar usuários bloqueados' })
  @ApiResponse({ status: 200, description: 'Lista de bloqueados.' })
  async list(@CurrentUser() currentUser: TCurrentUser) {
    const result = await this.blockService.listBlocked(currentUser);

    return {
      success: true,
      data: result.data,
      message: 'Usuários bloqueados listados com sucesso.',
      meta: result.meta,
    };
  }
}