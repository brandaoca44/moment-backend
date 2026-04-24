import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TCurrentUser } from '@/modules/auth/types/current-user.type';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { FindFeedQueryDto } from './dto/find-feed-query.dto';

@ApiTags('Posts')
@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @ApiCookieAuth()
  @ApiOperation({ summary: 'Criar um novo post' })
  @ApiResponse({
    status: 201,
    description: 'Post criado com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos ou conteúdo bloqueado.',
  })
  @ApiResponse({
    status: 401,
    description: 'Usuário não autenticado.',
  })
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  async create(
    @CurrentUser() user: TCurrentUser,
    @Body() body: CreatePostDto,
  ) {
    return this.postService.create(user, body);
  }

  @ApiOperation({ summary: 'Listar feed global' })
  @ApiResponse({
    status: 200,
    description: 'Feed global retornado com sucesso.',
  })
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get()
async findFeed(
  @CurrentUser() user: TCurrentUser,
  @Query() query: FindFeedQueryDto,
) {
  return this.postService.findFeed(user, query.cursor, query.limit);
}

  @ApiCookieAuth()
  @ApiOperation({ summary: 'Listar feed de usuários seguidos' })
  @ApiResponse({
    status: 200,
    description: 'Feed following retornado com sucesso.',
  })
  @ApiResponse({
    status: 401,
    description: 'Usuário não autenticado.',
  })
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('following')
  async findFollowingFeed(
    @CurrentUser() user: TCurrentUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.postService.findFollowingFeed(user, query.cursor, query.limit);
  }

  @ApiOperation({ summary: 'Buscar post por ID' })
  @ApiResponse({
    status: 200,
    description: 'Post retornado com sucesso.',
  })
  @ApiResponse({
    status: 404,
    description: 'Post não encontrado.',
  })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.postService.findOne(id);
  }

  @ApiCookieAuth()
  @ApiOperation({ summary: 'Atualizar um post' })
  @ApiResponse({
    status: 200,
    description: 'Post atualizado com sucesso.',
  })
  @ApiResponse({
    status: 401,
    description: 'Usuário não autenticado.',
  })
  @ApiResponse({
    status: 403,
    description: 'Usuário não autorizado a editar este post.',
  })
  @ApiResponse({
    status: 404,
    description: 'Post não encontrado.',
  })
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: TCurrentUser,
    @Body() body: UpdatePostDto,
  ) {
    return this.postService.update(id, user, body);
  }

  @ApiCookieAuth()
  @ApiOperation({ summary: 'Remover um post' })
  @ApiResponse({
    status: 200,
    description: 'Post removido com sucesso.',
  })
  @ApiResponse({
    status: 401,
    description: 'Usuário não autenticado.',
  })
  @ApiResponse({
    status: 403,
    description: 'Usuário não autorizado a remover este post.',
  })
  @ApiResponse({
    status: 404,
    description: 'Post não encontrado.',
  })
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.postService.remove(id, user);
  }

  @ApiCookieAuth()
  @ApiOperation({ summary: 'Curtir ou remover curtida de um post' })
  @ApiResponse({
    status: 200,
    description: 'Status de curtida alterado com sucesso.',
  })
  @ApiResponse({
    status: 401,
    description: 'Usuário não autenticado.',
  })
  @ApiResponse({
    status: 404,
    description: 'Post não encontrado.',
  })
  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  async toggleLike(
    @Param('id') id: string,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.postService.toggleLike(id, user);
  }

  @ApiCookieAuth()
  @ApiOperation({ summary: 'Consultar status de curtida de um post' })
  @ApiResponse({
    status: 200,
    description: 'Status de curtida retornado com sucesso.',
  })
  @ApiResponse({
    status: 401,
    description: 'Usuário não autenticado.',
  })
  @ApiResponse({
    status: 404,
    description: 'Post não encontrado.',
  })
  @UseGuards(JwtAuthGuard)
  @Get(':id/like-status')
  async getLikeStatus(
    @Param('id') id: string,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.postService.getLikeStatus(id, user);
  }

  @ApiCookieAuth()
  @ApiOperation({ summary: 'Remontar ou remover remont de um post' })
  @ApiResponse({
    status: 200,
    description: 'Status de remont alterado com sucesso.',
  })
  @ApiResponse({
    status: 401,
    description: 'Usuário não autenticado.',
  })
  @ApiResponse({
    status: 404,
    description: 'Post não encontrado.',
  })
  @UseGuards(JwtAuthGuard)
  @Post(':id/remont')
  async toggleRemont(
    @Param('id') id: string,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.postService.toggleRemont(id, user);
  }

  @ApiCookieAuth()
  @ApiOperation({ summary: 'Consultar status de remont de um post' })
  @ApiResponse({
    status: 200,
    description: 'Status de remont retornado com sucesso.',
  })
  @ApiResponse({
    status: 401,
    description: 'Usuário não autenticado.',
  })
  @ApiResponse({
    status: 404,
    description: 'Post não encontrado.',
  })
  @UseGuards(JwtAuthGuard)
  @Get(':id/remont-status')
  async getRemontStatus(
    @Param('id') id: string,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.postService.getRemontStatus(id, user);
  }
}