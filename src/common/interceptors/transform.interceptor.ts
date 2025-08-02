import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: {
    timestamp: string;
    requestId?: string;
    version: string;
  };
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();

    return next.handle().pipe(
      map((data) => {
        // Skip transformation for health check and documentation endpoints
        if (this.shouldSkipTransformation(request.url)) {
          return data;
        }

        // Transform response to standard format
        return {
          success: true,
          data,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.headers['x-request-id'] as string,
            version: '1.0.0',
          },
        };
      }),
    );
  }

  private shouldSkipTransformation(url: string): boolean {
    const skipPaths = [
      '/',
      '/health',
      '/api/docs',
      '/api-json',
      '/favicon.ico',
    ];

    return skipPaths.some((path) => url === path || url.startsWith(path));
  }
}
