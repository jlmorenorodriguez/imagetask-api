import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Interface for error response structure
 */
export interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
  error?: string;
  details?: string[];
}

/**
 * Interface for NestJS exception response object
 */
interface NestJSExceptionResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
}

/**
 * Interface for user information extracted from request
 */
interface UserInfo {
  ip: string;
  userAgent: string | undefined;
  requestId: string | string[] | undefined;
}

/**
 * Interface for error log context
 */
interface ErrorLogContext extends ErrorResponse {
  stack?: string;
  user: UserInfo;
}

/**
 * Type for possible exception response formats
 */
type ExceptionResponse =
  | string
  | NestJSExceptionResponse
  | Record<string, unknown>;

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    const exceptionResponse = exception.getResponse() as ExceptionResponse;
    const message = this.extractMessage(exceptionResponse);

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error: exception.name,
    };

    // Add validation details for bad request errors
    if (
      status === HttpStatus.BAD_REQUEST &&
      this.isObjectResponse(exceptionResponse)
    ) {
      const details = this.extractValidationDetails(exceptionResponse);
      if (details.length > 0) {
        errorResponse.details = details;
      }
    }

    // Log error with context
    const logContext: ErrorLogContext = {
      ...errorResponse,
      stack: exception.stack,
      user: this.extractUserInfo(request),
    };

    this.logger.error(
      `HTTP Exception: ${status} ${exception.message}`,
      logContext,
    );

    response.status(status).json(errorResponse);
  }

  private extractMessage(
    exceptionResponse: ExceptionResponse,
  ): string | string[] {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (this.isNestJSResponse(exceptionResponse)) {
      return exceptionResponse.message;
    }

    if (
      this.isObjectResponse(exceptionResponse) &&
      'message' in exceptionResponse
    ) {
      const message = exceptionResponse.message;
      if (typeof message === 'string' || Array.isArray(message)) {
        return message as string | string[];
      }
    }

    return 'Unknown error occurred';
  }

  private extractValidationDetails(
    exceptionResponse: Record<string, unknown>,
  ): string[] {
    const message = exceptionResponse.message;

    if (Array.isArray(message)) {
      return message.filter((item): item is string => typeof item === 'string');
    }

    return [];
  }

  private extractUserInfo(request: Request): UserInfo {
    // Extract relevant user information for logging
    // Avoid logging sensitive data
    return {
      ip: request.ip,
      userAgent: request.get('User-Agent'),
      requestId: request.headers['x-request-id'],
    };
  }

  // Type guard functions
  private isNestJSResponse(
    response: ExceptionResponse,
  ): response is NestJSExceptionResponse {
    return (
      typeof response === 'object' &&
      response !== null &&
      'statusCode' in response &&
      'message' in response &&
      typeof response.statusCode === 'number' &&
      (typeof response.message === 'string' || Array.isArray(response.message))
    );
  }

  private isObjectResponse(
    response: ExceptionResponse,
  ): response is Record<string, unknown> {
    return typeof response === 'object' && response !== null;
  }
}
