import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
  error?: string;
  details?: any;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    const exceptionResponse = exception.getResponse();
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
      typeof exceptionResponse === 'object'
    ) {
      const details = (exceptionResponse as any).message;
      if (Array.isArray(details)) {
        errorResponse.details = details;
      }
    }

    // Log error with context
    this.logger.error(`HTTP Exception: ${status} ${exception.message}`, {
      ...errorResponse,
      stack: exception.stack,
      user: this.extractUserInfo(request),
    });

    response.status(status).json(errorResponse);
  }

  private extractMessage(exceptionResponse: any): string | string[] {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (typeof exceptionResponse === 'object') {
      return exceptionResponse.message || 'Unknown error occurred';
    }

    return 'Unknown error occurred';
  }

  private extractUserInfo(request: Request): any {
    // Extract relevant user information for logging
    // Avoid logging sensitive data
    return {
      ip: request.ip,
      userAgent: request.get('User-Agent'),
      requestId: request.headers['x-request-id'],
    };
  }
}
