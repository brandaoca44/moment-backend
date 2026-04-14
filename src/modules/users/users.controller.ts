import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TCurrentUser } from '@/modules/auth/types/current-user.type';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { Query } from '@nestjs/common';
import { UserSuggestionsQueryDto } from './dto/user-suggestions-query.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Patch('me/avatar')
  async updateAvatar(
    @Body() body: UpdateAvatarDto,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.usersService.updateAvatar(body.url, user);
  }

    @UseGuards(JwtAuthGuard)
  @Get('suggestions')
  async getSuggestions(
    @CurrentUser() user: TCurrentUser,
    @Query() query: UserSuggestionsQueryDto,
  ) {
    return this.usersService.getSuggestions(user, query.limit);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/follow')
  async followUser(
    @Param('id') id: string,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.usersService.followUser(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/follow')
  async unfollowUser(
    @Param('id') id: string,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.usersService.unfollowUser(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/follow-status')
  async getFollowStatus(
    @Param('id') id: string,
    @CurrentUser() user: TCurrentUser,
  ) {
    return this.usersService.getFollowStatus(id, user);
  }
}