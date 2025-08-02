import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';
import { ErrorResponse } from './http-exception.filter';

@Catch(MongooseError)
export class MongooseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MongooseExceptionFilter.name);

  catch(exception: MongooseError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, error } = this.handleMongooseError(exception);

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
    };

    this.logger.error(
      `Mongoose Error: ${exception.name} - ${exception.message}`,
      {
        ...errorResponse,
        stack: exception.stack,
        mongooseError: {
          name: exception.name,
          path: (exception as any).path,
          value: (exception as any).value,
          kind: (exception as any).kind,
        },
      },
    );

    response.status(status).json(errorResponse);
  }

  private handleMongooseError(exception: MongooseError): {
    status: number;
    message: string;
    error: string;
  } {
    switch (exception.name) {
      case 'CastError':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Invalid ID format provided',
          error: 'Bad Request',
        };

      case 'ValidationError':
        const validationError = exception as MongooseError.ValidationError;
        const messages = Object.values(validationError.errors).map(
          (err) => err.message,
        );
        return {
          status: HttpStatus.BAD_REQUEST,
          message: messages.join('; '),
          error: 'Validation Error',
        };

      case 'DocumentNotFoundError':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Resource not found',
          error: 'Not Found',
        };

      case 'VersionError':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Document was modified by another process',
          error: 'Conflict',
        };

      case 'OverwriteModelError':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Model overwrite attempted',
          error: 'Conflict',
        };

      case 'MissingSchemaError':
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Schema configuration error',
          error: 'Internal Server Error',
        };

      case 'DivergentArrayError':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Array field modification conflict',
          error: 'Bad Request',
        };

      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database operation failed',
          error: 'Internal Server Error',
        };
    }
  }
}
