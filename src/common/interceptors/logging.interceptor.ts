import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url, ip } = request;
    const userAgent = request.get('User-Agent') || '';
    const startTime = Date.now();

    // Generate request ID for tracking
    const requestId = this.generateRequestId();
    request.headers['x-request-id'] = requestId;

    this.logger.log(`Incoming Request: ${method} ${url}`, {
      requestId,
      method,
      url,
      ip,
      userAgent,
      body: this.sanitizeBody(request.body),
      query: request.query,
      params: request.params,
    });

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        this.logger.log(
          `Outgoing Response: ${method} ${url} - ${statusCode} - ${duration}ms`,
          {
            requestId,
            method,
            url,
            statusCode,
            duration,
            responseSize: this.getResponseSize(data),
          },
        );
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        this.logger.error(`Request Error: ${method} ${url} - ${duration}ms`, {
          requestId,
          method,
          url,
          duration,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        });

        throw error;
      }),
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    // Remove sensitive fields from logging
    const sensitiveFields = [
      'password',
      'token',
      'apiKey',
      'secret',
      'authorization',
      'creditCard',
      'ssn',
    ];

    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private getResponseSize(data: any): number {
    if (!data) return 0;

    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }
}
