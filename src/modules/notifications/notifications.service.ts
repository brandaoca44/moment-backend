import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { TCurrentUser } from '@/modules/auth/types/current-user.type';
import { BlockService } from '@/modules/block/block.service';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockService: BlockService,
  ) {}

  private getSafeLimit(limit?: number) {
    const parsed = Number(limit);
    if (!parsed || parsed < 1) return DEFAULT_LIMIT;
    return Math.min(parsed, MAX_LIMIT);
  }

  async findMine(user: TCurrentUser, limit?: number) {
    const safeLimit = this.getSafeLimit(limit);
    const blockedIds = await this.blockService.getBlockedIds(user.id);

    const blockFilter =
      blockedIds.size > 0
        ? {
            actorId: {
              notIn: [...blockedIds],
            },
            OR: [
              {
                post: null,
              },
              {
                post: {
                  userId: {
                    notIn: [...blockedIds],
                  },
                },
              },
            ],
          }
        : {};

    const notifications = await this.prisma.notification.findMany({
      where: {
        userId: user.id,
        ...blockFilter,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: safeLimit,
      select: {
        id: true,
        type: true,
        read: true,
        createdAt: true,
        postId: true,
        actorId: true,
        actor: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        post: {
          select: {
            id: true,
            content: true,
            imageUrl: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    const unreadCount = await this.prisma.notification.count({
      where: {
        userId: user.id,
        read: false,
        ...blockFilter,
      },
    });

    return {
      data: notifications,
      meta: {
        unreadCount,
        limit: safeLimit,
      },
    };
  }

  async markAsRead(notificationId: string, user: TCurrentUser) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: {
        id: true,
        userId: true,
        read: true,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notificação não encontrada.');
    }

    if (notification.userId !== user.id) {
      throw new ForbiddenException('Você não pode alterar esta notificação.');
    }

    if (notification.read) {
      return {
        message: 'Notificação já estava lida.',
      };
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    return {
      message: 'Notificação marcada como lida.',
    };
  }

  async markAllAsRead(user: TCurrentUser) {
  const blockedIds = await this.blockService.getBlockedIds(user.id);

  const blockFilter =
    blockedIds.size > 0
      ? {
          actorId: {
            notIn: [...blockedIds],
          },
          OR: [
            {
              post: null,
            },
            {
              post: {
                userId: {
                  notIn: [...blockedIds],
                },
              },
            },
          ],
        }
      : {};

  const result = await this.prisma.notification.updateMany({
    where: {
      userId: user.id,
      read: false,
      ...blockFilter,
    },
    data: {
      read: true,
    },
  });

  return {
    message: 'Notificações marcadas como lidas.',
    updatedCount: result.count,
  };
  }
}