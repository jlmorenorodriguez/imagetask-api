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

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: any, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Skip HttpExceptions as they are handled by HttpExceptionFilter
    if (exception instanceof HttpException) {
      return;
    }

    const status = this.getHttpStatus(exception);
    const message = this.getErrorMessage(exception);

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error: exception.name || 'Internal Server Error',
    };

    // Log critical errors with full context
    this.logger.error(
      `Unhandled Exception: ${exception.message || 'Unknown error'}`,
      {
        ...errorResponse,
        stack: exception.stack,
        exception: {
          name: exception.name,
          message: exception.message,
          code: exception.code,
        },
        request: {
          ip: request.ip,
          userAgent: request.get('User-Agent'),
          body: this.sanitizeRequestBody(request.body),
          params: request.params,
          query: request.query,
        },
      },
    );

    response.status(status).json(errorResponse);
  }

  private getHttpStatus(exception: any): number {
    // Handle specific error types
    if (exception.name === 'ValidationError') {
      return HttpStatus.BAD_REQUEST;
    }

    if (
      exception.name === 'CastError' ||
      exception.name === 'ObjectParameterError'
    ) {
      return HttpStatus.BAD_REQUEST;
    }

    if (exception.name === 'MongoError' || exception.name === 'MongooseError') {
      if (exception.code === 11000) {
        return HttpStatus.CONFLICT; // Duplicate key error
      }
      return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    if (exception.name === 'TimeoutError') {
      return HttpStatus.REQUEST_TIMEOUT;
    }

    if (exception.code === 'ECONNREFUSED' || exception.code === 'ENOTFOUND') {
      return HttpStatus.SERVICE_UNAVAILABLE;
    }

    // Default to internal server error
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getErrorMessage(exception: any): string {
    // Handle specific error types with user-friendly messages
    if (exception.name === 'ValidationError') {
      return 'Validation failed. Please check your input data.';
    }

    if (exception.name === 'CastError') {
      return 'Invalid ID format provided.';
    }

    if (exception.name === 'MongoError' && exception.code === 11000) {
      return 'Resource already exists.';
    }

    if (exception.code === 'ECONNREFUSED') {
      return 'Service temporarily unavailable. Please try again later.';
    }

    if (exception.name === 'TimeoutError') {
      return 'Request timeout. Please try again.';
    }

    // For production, return generic message for security
    if (process.env.NODE_ENV === 'production') {
      return 'An unexpected error occurred. Please try again later.';
    }

    // For development, return actual error message
    return exception.message || 'An unexpected error occurred';
  }

  private sanitizeRequestBody(body: any): any {
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
    ];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
