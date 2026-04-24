import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { TCurrentUser } from '@/modules/auth/types/current-user.type';

@Injectable()
export class BlockService {
  constructor(private readonly prisma: PrismaService) {}

  async blockUser(targetUserId: string, currentUser: TCurrentUser) {
    if (targetUserId === currentUser.id) {
      throw new BadRequestException('Você não pode bloquear a si mesmo.');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.follow.deleteMany({
        where: {
          OR: [
            { followerId: currentUser.id, followingId: targetUserId },
            { followerId: targetUserId, followingId: currentUser.id },
          ],
        },
      });

      const block = await tx.block.upsert({
        where: {
          blockerId_blockedId: {
            blockerId: currentUser.id,
            blockedId: targetUserId,
          },
        },
        update: {},
        create: {
          blockerId: currentUser.id,
          blockedId: targetUserId,
        },
        select: {
          id: true,
          createdAt: true,
          blocked: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
        },
      });

      return block;
    });

    return {
      blocked: true,
      user: result.blocked,
      blockedAt: result.createdAt,
    };
  }

  async unblockUser(targetUserId: string, currentUser: TCurrentUser) {
    if (targetUserId === currentUser.id) {
      throw new BadRequestException('Você não pode desbloquear a si mesmo.');
    }

    await this.prisma.block.deleteMany({
      where: {
        blockerId: currentUser.id,
        blockedId: targetUserId,
      },
    });

    return {
      blocked: false,
    };
  }

  async listBlocked(currentUser: TCurrentUser) {
    const blocks = await this.prisma.block.findMany({
      where: {
        blockerId: currentUser.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        createdAt: true,
        blocked: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    return {
      data: blocks.map((block) => ({
        id: block.id,
        blockedAt: block.createdAt,
        user: block.blocked,
      })),
      meta: {
        count: blocks.length,
      },
    };
  }

  async getBlockedIds(userId: string): Promise<Set<string>> {
    const blocks = await this.prisma.block.findMany({
      where: {
        OR: [{ blockerId: userId }, { blockedId: userId }],
      },
      select: {
        blockerId: true,
        blockedId: true,
      },
    });

    const ids = new Set<string>();

    for (const block of blocks) {
      ids.add(block.blockerId === userId ? block.blockedId : block.blockerId);
    }

    return ids;
  }

  async isBlockedBetween(userAId: string, userBId: string) {
    if (userAId === userBId) return false;

    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userAId, blockedId: userBId },
          { blockerId: userBId, blockedId: userAId },
        ],
      },
      select: {
        id: true,
      },
    });

    return Boolean(block);
  }
}