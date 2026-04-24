import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ModerationStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { TCurrentUser } from '@/modules/auth/types/current-user.type';
import { ModerationService } from '@/modules/moderation/moderation.service';
import { UploadService } from '@/modules/upload/upload.service';
import { BlockService } from '@/modules/block/block.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { extractMentions } from '@/common/utils/extract-mentions.util';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_MENTIONS_PER_POST = 10;

type CursorPayload = {
  id: string;
  createdAt: string;
};

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly upload: UploadService,
    private readonly blockService: BlockService,
  ) {}

  private getSafeLimit(limit?: number): number {
    const parsed = Number(limit);
    if (!parsed || parsed < 1) return DEFAULT_LIMIT;
    return Math.min(parsed, MAX_LIMIT);
  }

  private encodeCursor(payload: CursorPayload): string {
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  private decodeCursor(cursor?: string): CursorPayload | null {
    if (!cursor) return null;

    try {
      const parsed = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf-8'),
      ) as CursorPayload;

      if (!parsed?.id || !parsed?.createdAt) {
        throw new Error('Cursor inválido');
      }

      return parsed;
    } catch {
      throw new BadRequestException('Cursor inválido.');
    }
  }

  private buildCursorWhere(cursor?: string) {
    const decoded = this.decodeCursor(cursor);

    if (!decoded) return undefined;

    const cursorDate = new Date(decoded.createdAt);

    return {
      OR: [
        {
          createdAt: {
            lt: cursorDate,
          },
        },
        {
          createdAt: cursorDate,
          id: {
            lt: decoded.id,
          },
        },
      ],
    };
  }

  private buildCursorMeta<T extends { id: string; createdAt: Date }>(
    posts: T[],
    limit: number,
  ) {
    const hasMore = posts.length > limit;
    const data = hasMore ? posts.slice(0, limit) : posts;
    const lastItem = data[data.length - 1];

    return {
      data,
      meta: {
        nextCursor:
          hasMore && lastItem
            ? this.encodeCursor({
                id: lastItem.id,
                createdAt: lastItem.createdAt.toISOString(),
              })
            : null,
        hasMore,
        limit,
      },
    };
  }


  private async ensurePostInteractable(postId: string, user: TCurrentUser) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        userId: true,
        moderationStatus: true,
      },
    });

    if (!post || post.moderationStatus !== ModerationStatus.APPROVED) {
      throw new NotFoundException('Post não encontrado.');
    }

    const isBlocked = await this.blockService.isBlockedBetween(
      user.id,
      post.userId,
    );

    if (isBlocked) {
      throw new ForbiddenException('Você não pode interagir com este post.');
    }

    return post;
  }

  private async resolveMentionedUsers(content: string, authorId: string) {
    const usernames = extractMentions(content);

    if (usernames.length > MAX_MENTIONS_PER_POST) {
      throw new BadRequestException(
        `Máximo de ${MAX_MENTIONS_PER_POST} menções por post.`,
      );
    }

    if (usernames.length === 0) {
      return [];
    }

    const blockedIds = await this.blockService.getBlockedIds(authorId);

    const users = await this.prisma.user.findMany({
      where: {
        username: {
          in: usernames,
        },
        id: {
          not: authorId,
          ...(blockedIds.size > 0 ? { notIn: [...blockedIds] } : {}),
        },
      },
      select: {
        id: true,
        username: true,
      },
    });

    const foundUsernames = new Set(
      users.map((user) => user.username.toLowerCase()),
    );

    const invalidUsernames = usernames.filter(
      (username) => !foundUsernames.has(username.toLowerCase()),
    );

    if (invalidUsernames.length > 0) {
      throw new BadRequestException(
        `Usuários mencionados inválidos: ${invalidUsernames.map((u) => `@${u}`).join(', ')}`,
      );
    }

    return users;
  }

  private async createMentionsAndNotifications(
    tx: Prisma.TransactionClient,
    postId: string,
    authorId: string,
    mentionedUsers: Array<{ id: string; username: string }>,
  ) {
    if (mentionedUsers.length === 0) {
      return;
    }

    await tx.mention.createMany({
      data: mentionedUsers.map((mentionedUser) => ({
        postId,
        userId: mentionedUser.id,
      })),
      skipDuplicates: true,
    });

    await tx.notification.createMany({
      data: mentionedUsers.map((mentionedUser) => ({
        type: NotificationType.MENTION,
        userId: mentionedUser.id,
        postId,
        actorId: authorId,
      })),
    });
  }

  private async syncMentionsAndNotifications(
    tx: Prisma.TransactionClient,
    postId: string,
    authorId: string,
    mentionedUsers: Array<{ id: string; username: string }>,
  ) {
    const existingMentions = await tx.mention.findMany({
      where: { postId },
      select: { userId: true },
    });

    const existingIds = new Set(existingMentions.map((mention) => mention.userId));
    const nextIds = new Set(mentionedUsers.map((user) => user.id));

    const idsToRemove = [...existingIds].filter((id) => !nextIds.has(id));
    const usersToAdd = mentionedUsers.filter((user) => !existingIds.has(user.id));

    if (idsToRemove.length > 0) {
      await tx.mention.deleteMany({
        where: {
          postId,
          userId: { in: idsToRemove },
        },
      });

      await tx.notification.deleteMany({
        where: {
          postId,
          type: NotificationType.MENTION,
          userId: { in: idsToRemove },
        },
      });
    }

    if (usersToAdd.length > 0) {
      await tx.mention.createMany({
        data: usersToAdd.map((mentionedUser) => ({
          postId,
          userId: mentionedUser.id,
        })),
        skipDuplicates: true,
      });

      await tx.notification.createMany({
        data: usersToAdd.map((mentionedUser) => ({
          type: NotificationType.MENTION,
          userId: mentionedUser.id,
          postId,
          actorId: authorId,
        })),
      });
    }
  }

  async create(user: TCurrentUser, data: CreatePostDto) {
    const content = data.content.trim();
    const imageUrl = data.imageUrl?.trim() || null;

    const modResult = await this.moderation.moderate(content);

    if (modResult.action === 'BLOCKED') {
      throw new BadRequestException(modResult.reason);
    }

    const mentionedUsers = await this.resolveMentionedUsers(content, user.id);

    return this.prisma.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: {
          content,
          imageUrl,
          userId: user.id,
          moderationStatus:
            modResult.action === 'PENDING_REVIEW'
              ? ModerationStatus.PENDING_REVIEW
              : ModerationStatus.APPROVED,
        },
        select: { id: true },
      });

      await this.createMentionsAndNotifications(
        tx,
        post.id,
        user.id,
        mentionedUsers,
      );

      return tx.post.findUniqueOrThrow({
        where: { id: post.id },
        select: this.postSelect(),
      });
    });
  }

  async findFeed(currentUser: TCurrentUser, cursor?: string, limit?: number) {
    const safeLimit = this.getSafeLimit(limit);
    const cursorWhere = this.buildCursorWhere(cursor);
    const blockedIds = await this.blockService.getBlockedIds(currentUser.id);

    const posts = await this.prisma.post.findMany({
      where: {
        moderationStatus: ModerationStatus.APPROVED,
        ...(blockedIds.size > 0 ? { userId: { notIn: [...blockedIds] } } : {}),
        ...(cursorWhere ?? {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: safeLimit + 1,
      select: this.postSelect(),
    });

    return this.buildCursorMeta(posts, safeLimit);
  }

  async findFollowingFeed(
    user: TCurrentUser,
    cursor?: string,
    limit?: number,
  ) {
    const safeLimit = this.getSafeLimit(limit);
    const cursorWhere = this.buildCursorWhere(cursor);
    const blockedIds = await this.blockService.getBlockedIds(user.id);

    const following = await this.prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });

    const followingIds = [
      ...new Set([
        ...following
          .map((f) => f.followingId)
          .filter((id) => !blockedIds.has(id)),
        user.id,
      ]),
    ];

    const posts = await this.prisma.post.findMany({
      where: {
        userId: { in: followingIds },
        moderationStatus: ModerationStatus.APPROVED,
        ...(cursorWhere ?? {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: safeLimit + 1,
      select: this.postSelect(),
    });

    return this.buildCursorMeta(posts, safeLimit);
  }

  async findOne(postId: string, user?: TCurrentUser) {
    if (user) {
      await this.ensurePostInteractable(postId, user);
    }

    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        moderationStatus: ModerationStatus.APPROVED,
      },
      select: this.postSelect(),
    });

    if (!post) {
      throw new NotFoundException('Post não encontrado.');
    }

    return post;
  }

  async update(postId: string, user: TCurrentUser, data: UpdatePostDto) {
    const existingPost = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true },
    });

    if (!existingPost) {
      throw new NotFoundException('Post não encontrado.');
    }

    if (existingPost.userId !== user.id) {
      throw new ForbiddenException('Você não pode editar este post.');
    }

    const normalizedContent =
      data.content !== undefined ? data.content.trim() : undefined;

    let moderationStatus: ModerationStatus | undefined;
    let mentionedUsers: Array<{ id: string; username: string }> = [];

    if (normalizedContent !== undefined) {
      const modResult = await this.moderation.moderate(normalizedContent);

      if (modResult.action === 'BLOCKED') {
        throw new BadRequestException(modResult.reason);
      }

      moderationStatus =
        modResult.action === 'PENDING_REVIEW'
          ? ModerationStatus.PENDING_REVIEW
          : ModerationStatus.APPROVED;

      mentionedUsers = await this.resolveMentionedUsers(
        normalizedContent,
        user.id,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: postId },
        data: {
          ...(normalizedContent !== undefined
            ? { content: normalizedContent }
            : {}),
          ...(moderationStatus !== undefined ? { moderationStatus } : {}),
        },
      });

      if (normalizedContent !== undefined) {
        await this.syncMentionsAndNotifications(
          tx,
          postId,
          user.id,
          mentionedUsers,
        );
      }

      return tx.post.findUniqueOrThrow({
        where: { id: postId },
        select: this.postSelect(),
      });
    });
  }

  async remove(postId: string, user: TCurrentUser) {
    const existingPost = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true, imageUrl: true },
    });

    if (!existingPost) {
      throw new NotFoundException('Post não encontrado.');
    }

    if (existingPost.userId !== user.id) {
      throw new ForbiddenException('Você não pode excluir este post.');
    }

    const imageUrl = existingPost.imageUrl;

    await this.prisma.post.delete({
      where: { id: postId },
    });

    if (imageUrl) {
      await this.safeDeleteImage(
        imageUrl,
        `Falha ao remover imagem do post excluído ${postId}`,
      );
    }

    return { message: 'Post excluído com sucesso.' };
  }

  async toggleLike(postId: string, user: TCurrentUser) {
    await this.ensurePostInteractable(postId, user);

    const existingLike = await this.prisma.like.findUnique({
      where: { userId_postId: { userId: user.id, postId } },
    });

    if (existingLike) {
      await this.prisma.like.delete({
        where: { userId_postId: { userId: user.id, postId } },
      });

      const likesCount = await this.prisma.like.count({ where: { postId } });

      return {
        liked: false,
        likesCount,
        message: 'Like removido com sucesso.',
      };
    }

    await this.prisma.like.create({
      data: { userId: user.id, postId },
    });

    const likesCount = await this.prisma.like.count({ where: { postId } });

    return {
      liked: true,
      likesCount,
      message: 'Like realizado com sucesso.',
    };
  }

  async getLikeStatus(postId: string, user: TCurrentUser) {
    await this.ensurePostInteractable(postId, user);

    const like = await this.prisma.like.findUnique({
      where: { userId_postId: { userId: user.id, postId } },
    });

    const likesCount = await this.prisma.like.count({ where: { postId } });

    return {
      liked: Boolean(like),
      likesCount,
    };
  }

  async toggleRemont(postId: string, user: TCurrentUser) {
    await this.ensurePostInteractable(postId, user);

    const existingRemont = await this.prisma.remont.findUnique({
      where: { userId_postId: { userId: user.id, postId } },
    });

    if (existingRemont) {
      await this.prisma.remont.delete({
        where: { userId_postId: { userId: user.id, postId } },
      });

      const remontsCount = await this.prisma.remont.count({ where: { postId } });

      return {
        remonted: false,
        remontsCount,
        message: 'Remont removido com sucesso.',
      };
    }

    await this.prisma.remont.create({
      data: { userId: user.id, postId },
    });

    const remontsCount = await this.prisma.remont.count({ where: { postId } });

    return {
      remonted: true,
      remontsCount,
      message: 'Remont realizado com sucesso.',
    };
  }

  async getRemontStatus(postId: string, user: TCurrentUser) {
    await this.ensurePostInteractable(postId, user);

    const remont = await this.prisma.remont.findUnique({
      where: { userId_postId: { userId: user.id, postId } },
    });

    const remontsCount = await this.prisma.remont.count({ where: { postId } });

    return {
      remonted: Boolean(remont),
      remontsCount,
    };
  }

    private async safeDeleteImage(url: string, contextMessage: string) {
    try {
      await this.upload.deleteImage(url);
    } catch (error) {
      this.logger.warn(`${contextMessage}: ${url}`);
      this.logger.debug(
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private postSelect() {
    return {
      id: true,
      content: true,
      imageUrl: true,
      moderationStatus: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
        },
      },
      mentions: {
        select: {
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
      _count: {
        select: {
          likes: true,
          remonts: true,
        },
      },
    } as const;
  }
}