import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type ApiSuccessResponse = {
  success: true;
  data: unknown;
  message: string | null;
  meta?: unknown;
};

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiSuccessResponse> {
    return next.handle().pipe(
      map((response: unknown) => {
        if (response !== null && typeof response === 'object') {
          const record = response as Record<string, unknown>;

          const hasData = 'data' in record;
          const hasMessage = 'message' in record;
          const hasMeta = 'meta' in record;

          if (hasData || hasMessage || hasMeta) {
            return {
              success: true as const,
              data: hasData ? record.data : null,
              message:
                typeof record.message === 'string' ? record.message : null,
              ...(hasMeta ? { meta: record.meta } : {}),
            };
          }
        }

        return {
          success: true as const,
          data: response ?? null,
          message: null,
        };
      }),
    );
  }
}