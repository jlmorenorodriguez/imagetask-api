import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Interface for request with custom headers
 */
interface RequestWithId extends Request {
  headers: Request['headers'] & {
    'x-request-id'?: string;
  };
}

/**
 * Interface for sanitized request body
 */
type SanitizedBody = Record<string, unknown> | unknown;

/**
 * Interface for incoming request log data
 */
interface IncomingRequestLogData {
  requestId: string;
  method: string;
  url: string;
  ip: string;
  userAgent: string;
  body: SanitizedBody;
  query: Record<string, unknown>;
  params: Record<string, unknown>;
}

/**
 * Interface for outgoing response log data
 */
interface OutgoingResponseLogData {
  requestId: string;
  responseSize: number;
}

/**
 * Interface for error details
 */
interface ErrorDetails {
  name: string;
  message: string;
  stack?: string;
}

/**
 * Interface for error log data
 */
interface ErrorLogData {
  requestId: string;
  method: string;
  url: string;
  duration: number;
  error: ErrorDetails;
}

/**
 * Type for response data (can be any serializable value)
 */
type ResponseData = unknown;

/**
 * List of sensitive field names to redact
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'apiKey',
  'secret',
  'authorization',
  'creditCard',
  'ssn',
] as const;

@Injectable()
export class LoggingInterceptor
  implements NestInterceptor<ResponseData, ResponseData>
{
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler<ResponseData>,
  ): Observable<ResponseData> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<RequestWithId>();
    const response = ctx.getResponse<Response>();

    const { method, url, ip } = request;
    const userAgent = request.get('User-Agent') || '';
    const startTime = Date.now();

    // Generate request ID for tracking
    const requestId = this.generateRequestId();
    request.headers['x-request-id'] = requestId;

    // Create structured log data for incoming request
    const incomingLogData: IncomingRequestLogData = {
      requestId,
      method,
      url,
      ip,
      userAgent,
      body: this.sanitizeBody(request.body),
      query: request.query,
      params: request.params,
    };

    this.logger.log(
      `Incoming Request: ${method} ${url} - ${JSON.stringify(incomingLogData)}`,
    );

    return next.handle().pipe(
      tap((data: ResponseData) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        const outgoingLogData: OutgoingResponseLogData = {
          requestId,
          responseSize: this.getResponseSize(data),
        };

        this.logger.log(
          `Outgoing Response: ${method} ${url} - ${statusCode} - ${duration}ms - ${JSON.stringify(
            outgoingLogData,
          )}`,
        );
      }),
      catchError((error: unknown) => {
        const duration = Date.now() - startTime;
        const errorDetails = this.extractErrorDetails(error);

        this.logger.error(
          `Request Error: ${method} ${url} - ${duration}ms`,
          errorDetails.stack,
        );

        const errorLogData: ErrorLogData = {
          requestId,
          method,
          url,
          duration,
          error: errorDetails,
        };

        this.logger.error(JSON.stringify(errorLogData));

        return throwError(() => error);
      }),
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeBody(body: unknown): SanitizedBody {
    if (!body || typeof body !== 'object' || body === null) {
      return body;
    }

    // Handle arrays
    if (Array.isArray(body)) {
      return body.map((item) => this.sanitizeBody(item));
    }

    // Handle objects
    const bodyRecord = body as Record<string, unknown>;
    const sanitized: Record<string, unknown> = { ...bodyRecord };

    for (const field of SENSITIVE_FIELDS) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private getResponseSize(data: ResponseData): number {
    if (data === null || data === undefined) {
      return 0;
    }

    try {
      return JSON.stringify(data).length;
    } catch (error) {
      // If serialization fails, return 0
      this.logger.warn(
        'Failed to serialize response data for size calculation',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      );
      return 0;
    }
  }

  private extractErrorDetails(error: unknown): ErrorDetails {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Handle non-Error objects
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as Record<string, unknown>;
      return {
        name: typeof errorObj.name === 'string' ? errorObj.name : 'Unknown',
        message:
          typeof errorObj.message === 'string'
            ? errorObj.message
            : 'Unknown error',
        stack: typeof errorObj.stack === 'string' ? errorObj.stack : undefined,
      };
    }

    // Handle primitive values
    return {
      name: 'Unknown',
      message: String(error),
    };
  }
}
