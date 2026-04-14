import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TCurrentUser } from '@/modules/auth/types/current-user.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TCurrentUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);