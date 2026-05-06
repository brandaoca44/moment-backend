import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TCurrentUser } from '@/modules/auth/types/current-user.type';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UserSuggestionsQueryDto } from './dto/user-suggestions-query.dto';
import { DeleteMeDto } from './dto/delete-me.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiCookieAuth()
  @ApiOperation({ summary: 'Atualizar nome e/ou username do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil atualizado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Dados inválidos ou username já em uso.' })
  @ApiResponse({ status: 401, description: 'Usuário não autenticado.' })
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(
    @Body() body: UpdateMeDto,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.usersService.updateMe(body, user);
  }

  @ApiCookieAuth()
  @ApiOperation({ summary: 'Atualizar senha do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Senha atualizada com sucesso.' })
  @ApiResponse({ status: 400, description: 'Senha atual incorreta ou nova senha inválida.' })
  @ApiResponse({ status: 401, description: 'Usuário não autenticado.' })
  @UseGuards(JwtAuthGuard)
  @Patch('me/password')
  async updatePassword(
    @Body() body: UpdatePasswordDto,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.usersService.updatePassword(body, user);
  }

  @ApiCookieAuth()
  @ApiOperation({ summary: 'Deletar conta do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Conta deletada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Usuário não autenticado.' })
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Delete('me')
async deleteMe(
  @CurrentUser() user: TCurrentUser,
  @Body() body: DeleteMeDto,
) {
  return this.usersService.deleteMe(user, body.password);
}

  @ApiCookieAuth()
  @ApiOperation({ summary: 'Atualizar avatar do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Avatar atualizado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Usuário não autenticado.' })
  @UseGuards(JwtAuthGuard)
  @Patch('me/avatar')
  async updateAvatar(
    @Body() body: UpdateAvatarDto,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.usersService.updateAvatar(body.url, user);
  }

  @ApiCookieAuth()
  @ApiOperation({ summary: 'Listar sugestões de usuários' })
  @ApiResponse({ status: 200, description: 'Sugestões retornadas com sucesso.' })
  @ApiResponse({ status: 401, description: 'Usuário não autenticado.' })
  @UseGuards(JwtAuthGuard)
  @Get('suggestions')
  async getSuggestions(
    @CurrentUser() user: TCurrentUser,
    @Query() query: UserSuggestionsQueryDto,
  ) {
    return this.usersService.getSuggestions(user, query.limit);
  }

  @ApiCookieAuth()
  @ApiOperation({ summary: 'Seguir um usuário' })
  @ApiResponse({ status: 200, description: 'Usuário seguido com sucesso.' })
  @ApiResponse({ status: 401, description: 'Usuário não autenticado.' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  @UseGuards(JwtAuthGuard)
  @Post(':id/follow')
  async followUser(
    @Param('id') id: string,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.usersService.followUser(id, user);
  }

  @ApiCookieAuth()
  @ApiOperation({ summary: 'Deixar de seguir um usuário' })
  @ApiResponse({ status: 200, description: 'Usuário deixado de seguir com sucesso.' })
  @ApiResponse({ status: 401, description: 'Usuário não autenticado.' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  @UseGuards(JwtAuthGuard)
  @Delete(':id/follow')
  async unfollowUser(
    @Param('id') id: string,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.usersService.unfollowUser(id, user);
  }

  @ApiCookieAuth()
  @ApiOperation({ summary: 'Consultar status de follow' })
  @ApiResponse({ status: 200, description: 'Status de follow retornado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Usuário não autenticado.' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  @UseGuards(JwtAuthGuard)
  @Get(':id/follow-status')
  async getFollowStatus(
    @Param('id') id: string,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.usersService.getFollowStatus(id, user);
  }
}