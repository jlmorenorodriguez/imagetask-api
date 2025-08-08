import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponse } from './http-exception.filter';

/**
 * Interface for MongoDB error
 */
interface MongoError extends Error {
  code?: number;
}

/**
 * Interface for Mongoose validation error
 */
interface ValidationError extends Error {
  name: 'ValidationError';
  errors: Record<string, unknown>;
}

/**
 * Interface for Mongoose cast error
 */
interface CastError extends Error {
  name: 'CastError';
  path: string;
  value: unknown;
}

/**
 * Interface for Node.js system errors
 */
interface NodeSystemError extends Error {
  code: string;
  errno?: number;
  syscall?: string;
  path?: string;
}

/**
 * Interface for timeout errors
 */
interface TimeoutError extends Error {
  name: 'TimeoutError';
}

/**
 * Union type for all possible exceptions
 */
type KnownException =
  | HttpException
  | MongoError
  | ValidationError
  | CastError
  | NodeSystemError
  | TimeoutError
  | Error;

/**
 * Interface for exception details in logs
 */
interface ExceptionDetails {
  name?: string;
  message?: string;
  code?: string | number;
}

/**
 * Interface for request details in logs
 */
interface RequestDetails {
  ip: string;
  userAgent: string | undefined;
  body: Record<string, unknown>;
  params: Record<string, unknown>;
  query: Record<string, unknown>;
}

/**
 * Interface for error log context
 */
interface ErrorLogContext extends ErrorResponse {
  stack?: string;
  exception: ExceptionDetails;
  request: RequestDetails;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Skip HttpExceptions as they are handled by HttpExceptionFilter
    if (exception instanceof HttpException) {
      return;
    }

    const typedException = exception as KnownException;
    const status = this.getHttpStatus(typedException);
    const message = this.getErrorMessage(typedException);

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error: typedException.name || 'Internal Server Error',
    };

    // Log critical errors with full context
    const logContext: ErrorLogContext = {
      ...errorResponse,
      stack: typedException.stack,
      exception: {
        name: typedException.name,
        message: typedException.message,
        code: this.getExceptionCode(typedException),
      },
      request: {
        ip: request.ip,
        userAgent: request.get('User-Agent'),
        body: this.sanitizeRequestBody(request.body),
        params: request.params,
        query: request.query,
      },
    };

    this.logger.error(
      `Unhandled Exception: ${typedException.message || 'Unknown error'}`,
      logContext,
    );

    response.status(status).json(errorResponse);
  }

  private getHttpStatus(exception: KnownException): number {
    // Handle specific error types
    if (this.isValidationError(exception)) {
      return HttpStatus.BAD_REQUEST;
    }

    if (
      this.isCastError(exception) ||
      exception.name === 'ObjectParameterError'
    ) {
      return HttpStatus.BAD_REQUEST;
    }

    if (this.isMongoError(exception)) {
      if (exception.code === 11000) {
        return HttpStatus.CONFLICT; // Duplicate key error
      }
      return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    if (this.isTimeoutError(exception)) {
      return HttpStatus.REQUEST_TIMEOUT;
    }

    if (this.isNodeSystemError(exception)) {
      if (exception.code === 'ECONNREFUSED' || exception.code === 'ENOTFOUND') {
        return HttpStatus.SERVICE_UNAVAILABLE;
      }
    }

    // Default to internal server error
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getErrorMessage(exception: KnownException): string {
    // Handle specific error types with user-friendly messages
    if (this.isValidationError(exception)) {
      return 'Validation failed. Please check your input data.';
    }

    if (this.isCastError(exception)) {
      return 'Invalid ID format provided.';
    }

    if (this.isMongoError(exception) && exception.code === 11000) {
      return 'Resource already exists.';
    }

    if (
      this.isNodeSystemError(exception) &&
      exception.code === 'ECONNREFUSED'
    ) {
      return 'Service temporarily unavailable. Please try again later.';
    }

    if (this.isTimeoutError(exception)) {
      return 'Request timeout. Please try again.';
    }

    // For production, return generic message for security
    if (process.env.NODE_ENV === 'production') {
      return 'An unexpected error occurred. Please try again later.';
    }

    // For development, return actual error message
    return exception.message || 'An unexpected error occurred';
  }

  private sanitizeRequestBody(body: unknown): Record<string, unknown> {
    if (!body || typeof body !== 'object' || body === null) {
      return {};
    }

    // Remove sensitive fields from logging
    const sensitiveFields = [
      'password',
      'token',
      'apiKey',
      'secret',
      'authorization',
    ];

    const sanitized = { ...(body as Record<string, unknown>) };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private getExceptionCode(
    exception: KnownException,
  ): string | number | undefined {
    if (this.isMongoError(exception) || this.isNodeSystemError(exception)) {
      return exception.code;
    }
    return undefined;
  }

  // Type guard functions for better type safety
  private isValidationError(error: unknown): error is ValidationError {
    return error instanceof Error && error.name === 'ValidationError';
  }

  private isCastError(error: unknown): error is CastError {
    return error instanceof Error && error.name === 'CastError';
  }

  private isMongoError(error: unknown): error is MongoError {
    return (
      error instanceof Error &&
      (error.name === 'MongoError' || error.name === 'MongoServerError')
    );
  }

  private isTimeoutError(error: unknown): error is TimeoutError {
    return error instanceof Error && error.name === 'TimeoutError';
  }

  private isNodeSystemError(error: unknown): error is NodeSystemError {
    return (
      error instanceof Error &&
      'code' in error &&
      typeof (error as NodeSystemError).code === 'string'
    );
  }
}
