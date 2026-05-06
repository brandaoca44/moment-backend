import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '@/prisma/prisma.service';
import { TCurrentUser } from '@/modules/auth/types/current-user.type';
import { UploadService } from '@/modules/upload/upload.service';
import { BlockService } from '@/modules/block/block.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly upload: UploadService,
    private readonly blockService: BlockService,
  ) {}

  async updateMe(
    data: { name?: string; username?: string },
    currentUser: TCurrentUser,
  ) {
    const name = data.name?.trim();
    const username = data.username?.trim().toLowerCase();

    if (!name && !username) {
      throw new BadRequestException('Nenhum dado para atualizar.');
    }

    if (username) {
      const existing = await this.prisma.user.findFirst({
        where: {
          username,
          NOT: { id: currentUser.id },
        },
        select: { id: true },
      });

      if (existing) {
        throw new BadRequestException('Username já está em uso.');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: currentUser.id },
      data: {
        ...(name ? { name } : {}),
        ...(username ? { username } : {}),
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      user: updated,
      message: 'Perfil atualizado com sucesso.',
    };
  }

  async updatePassword(
    data: { currentPassword: string; newPassword: string },
    currentUser: TCurrentUser,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const isValid = await argon2.verify(user.password, data.currentPassword);

    if (!isValid) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    const isSamePassword = await argon2.verify(user.password, data.newPassword);

    if (isSamePassword) {
      throw new BadRequestException(
        'A nova senha deve ser diferente da senha atual.',
      );
    }

    const newHash = await argon2.hash(data.newPassword);

    await this.prisma.user.update({
      where: { id: currentUser.id },
      data: {
        password: newHash,
        refreshTokenHash: null, // invalida todas as sessões
      },
    });

    return {
      message: 'Senha atualizada com sucesso. Faça login novamente.',
    };
  }

  async deleteMe(currentUser: TCurrentUser, password: string) {
  const user = await this.prisma.user.findUnique({
    where: { id: currentUser.id },
    select: { id: true, avatar: true, password: true },
  });

  if (!user) {
    throw new NotFoundException('Usuário não encontrado.');
  }

  const isValid = await argon2.verify(user.password, password);

  if (!isValid) {
    throw new UnauthorizedException('Senha incorreta.');
  }

  await this.prisma.user.delete({
    where: { id: currentUser.id },
  });

  if (user.avatar) {
    try {
      await this.upload.deleteImage(user.avatar);
    } catch (error) {
      this.logger.warn(
        `Falha ao remover avatar do usuário deletado ${currentUser.id}`,
      );
      this.logger.debug(error instanceof Error ? error.stack : String(error));
    }
  }

  return {
    message: 'Conta deletada com sucesso.',
  };
}

  async getSuggestions(currentUser: TCurrentUser, limit = 5) {
    const safeLimit = Number(limit) > 0 ? Math.min(Number(limit), 20) : 5;

    const [following, blockedIds] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: currentUser.id },
        select: { followingId: true },
      }),
      this.blockService.getBlockedIds(currentUser.id),
    ]);

    const followingIds = following.map((f) => f.followingId);
    const excludeIds = new Set([
      currentUser.id,
      ...followingIds,
      ...blockedIds,
    ]);

    if (followingIds.length === 0) {
      const popular = await this.prisma.user.findMany({
        where: { id: { notIn: [...excludeIds] } },
        orderBy: { followers: { _count: 'desc' } },
        take: safeLimit,
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          _count: { select: { followers: true } },
        },
      });

      const data = popular
        .map((u) => ({
          id: u.id,
          name: u.name,
          username: u.username,
          avatar: u.avatar,
          followersCount: u._count.followers,
          mutualCount: 0,
        }))
        .sort((a, b) => b.followersCount - a.followersCount);

      return { data, meta: { limit: safeLimit, count: data.length } };
    }

    const friendsOfFriends = await this.prisma.follow.findMany({
      where: {
        followerId: { in: followingIds },
        followingId: { notIn: [...excludeIds] },
      },
      select: { followingId: true },
    });

    const mutualCountMap = new Map<string, number>();

    for (const { followingId } of friendsOfFriends) {
      mutualCountMap.set(
        followingId,
        (mutualCountMap.get(followingId) ?? 0) + 1,
      );
    }

    if (mutualCountMap.size === 0) {
      const popular = await this.prisma.user.findMany({
        where: { id: { notIn: [...excludeIds] } },
        orderBy: { followers: { _count: 'desc' } },
        take: safeLimit,
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          _count: { select: { followers: true } },
        },
      });

      const data = popular
        .map((u) => ({
          id: u.id,
          name: u.name,
          username: u.username,
          avatar: u.avatar,
          followersCount: u._count.followers,
          mutualCount: 0,
        }))
        .sort((a, b) => b.followersCount - a.followersCount);

      return { data, meta: { limit: safeLimit, count: data.length } };
    }

    const rankedIds = [...mutualCountMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, safeLimit)
      .map(([id]) => id);

    const users = await this.prisma.user.findMany({
      where: { id: { in: rankedIds } },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        _count: { select: { followers: true } },
      },
    });

    const data = users
      .map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        avatar: u.avatar,
        followersCount: u._count.followers,
        mutualCount: mutualCountMap.get(u.id) ?? 0,
      }))
      .sort((a, b) => {
        if (b.mutualCount !== a.mutualCount) return b.mutualCount - a.mutualCount;
        return b.followersCount - a.followersCount;
      });

    return { data, meta: { limit: safeLimit, count: data.length } };
  }

  async updateAvatar(url: string, currentUser: TCurrentUser) {
    const normalizedUrl = url.trim();

    if (!normalizedUrl) {
      throw new BadRequestException('URL do avatar é obrigatória.');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { id: true, avatar: true },
    });

    if (!existingUser) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const oldAvatar = existingUser.avatar;
    const shouldDeleteOldAvatar =
      Boolean(oldAvatar) && oldAvatar !== normalizedUrl;

    const updated = await this.prisma.user.update({
      where: { id: currentUser.id },
      data: { avatar: normalizedUrl },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (shouldDeleteOldAvatar && oldAvatar) {
      try {
        await this.upload.deleteImage(oldAvatar);
      } catch (error) {
        this.logger.warn(
          `Falha ao remover avatar antigo do usuário ${currentUser.id}: ${oldAvatar}`,
        );
        this.logger.debug(
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return {
      user: updated,
      message: 'Avatar atualizado com sucesso.',
    };
  }

  async followUser(targetUserId: string, currentUser: TCurrentUser) {
    if (targetUserId === currentUser.id) {
      throw new BadRequestException('Você não pode seguir a si mesmo.');
    }

    const blockedIds = await this.blockService.getBlockedIds(currentUser.id);
    if (blockedIds.has(targetUserId)) {
      throw new BadRequestException('Não é possível seguir este usuário.');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUser.id,
          followingId: targetUserId,
        },
      },
    });

    if (existingFollow) {
      return { following: true, message: 'Você já segue este usuário.' };
    }

    await this.prisma.follow.create({
      data: { followerId: currentUser.id, followingId: targetUserId },
    });

    const followersCount = await this.prisma.follow.count({
      where: { followingId: targetUserId },
    });

    return {
      following: true,
      followersCount,
      message: 'Usuário seguido com sucesso.',
    };
  }

  async unfollowUser(targetUserId: string, currentUser: TCurrentUser) {
    if (targetUserId === currentUser.id) {
      throw new BadRequestException(
        'Você não pode deixar de seguir a si mesmo.',
      );
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUser.id,
          followingId: targetUserId,
        },
      },
    });

    if (!existingFollow) {
      const followersCount = await this.prisma.follow.count({
        where: { followingId: targetUserId },
      });

      return {
        following: false,
        followersCount,
        message: 'Você já não seguia este usuário.',
      };
    }

    await this.prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: currentUser.id,
          followingId: targetUserId,
        },
      },
    });

    const followersCount = await this.prisma.follow.count({
      where: { followingId: targetUserId },
    });

    return {
      following: false,
      followersCount,
      message: 'Unfollow realizado com sucesso.',
    };
  }

  async getFollowStatus(targetUserId: string, currentUser: TCurrentUser) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, username: true, avatar: true },
    });

    if (!targetUser) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUser.id,
          followingId: targetUserId,
        },
      },
    });

    const followersCount = await this.prisma.follow.count({
      where: { followingId: targetUserId },
    });

    const followingCount = await this.prisma.follow.count({
      where: { followerId: targetUserId },
    });

    return {
      user: targetUser,
      following: Boolean(follow),
      followersCount,
      followingCount,
    };
  }
}