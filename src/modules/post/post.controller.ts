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
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TCurrentUser } from '@/modules/auth/types/current-user.type';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  async create(
    @CurrentUser() user: TCurrentUser,
    @Body() body: CreatePostDto,
  ) {
    return this.postService.create(user, body);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get()
  async findFeed(@Query() query: PaginationQueryDto) {
    return this.postService.findFeed(query.cursor, query.limit);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('following')
  async findFollowingFeed(
    @CurrentUser() user: TCurrentUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.postService.findFollowingFeed(user, query.cursor, query.limit);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.postService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: TCurrentUser,
    @Body() body: UpdatePostDto,
  ) {
    return this.postService.update(id, user, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.postService.remove(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  async toggleLike(
    @Param('id') id: string,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.postService.toggleLike(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/like-status')
  async getLikeStatus(
    @Param('id') id: string,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.postService.getLikeStatus(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/remont')
  async toggleRemont(
    @Param('id') id: string,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.postService.toggleRemont(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/remont-status')
  async getRemontStatus(
    @Param('id') id: string,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.postService.getRemontStatus(id, user);
  }
}