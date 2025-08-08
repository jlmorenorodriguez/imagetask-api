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

/**
 * Interface for Mongoose CastError
 */
interface MongooseCastError extends MongooseError {
  name: 'CastError';
  path: string;
  value: unknown;
  kind: string;
  model?: {
    modelName: string;
  };
}

/**
 * Interface for Mongoose ValidationError details
 */
interface ValidationErrorDetails {
  message: string;
  path: string;
  value: unknown;
  kind?: string;
}

/**
 * Interface for Mongoose ValidationError
 */
interface MongooseValidationError extends MongooseError {
  name: 'ValidationError';
  errors: Record<string, ValidationErrorDetails>;
}

/**
 * Interface for Mongoose DocumentNotFoundError
 */
interface MongooseDocumentNotFoundError extends MongooseError {
  name: 'DocumentNotFoundError';
  query: Record<string, unknown>;
  model: {
    modelName: string;
  };
}

/**
 * Interface for Mongoose VersionError
 */
interface MongooseVersionError extends MongooseError {
  name: 'VersionError';
  version: number;
  modifiedPaths: string[];
}

/**
 * Interface for Mongoose OverwriteModelError
 */
interface MongooseOverwriteModelError extends MongooseError {
  name: 'OverwriteModelError';
  model: string;
}

/**
 * Interface for Mongoose MissingSchemaError
 */
interface MongooseMissingSchemaError extends MongooseError {
  name: 'MissingSchemaError';
  model: string;
}

/**
 * Interface for Mongoose DivergentArrayError
 */
interface MongooseDivergentArrayError extends MongooseError {
  name: 'DivergentArrayError';
  path: string;
}

/**
 * Interface for Mongoose error details in logs
 */
interface MongooseErrorDetails {
  name: string;
  path?: string;
  value?: unknown;
  kind?: string;
  model?: string;
  query?: Record<string, unknown>;
  version?: number;
  modifiedPaths?: string[];
}

/**
 * Interface for error handling result
 */
interface ErrorHandlingResult {
  status: number;
  message: string;
  error: string;
}

/**
 * Interface for error log context
 */
interface MongooseErrorLogContext extends ErrorResponse {
  stack?: string;
  mongooseError: MongooseErrorDetails;
}

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

    const logContext: MongooseErrorLogContext = {
      ...errorResponse,
      stack: exception.stack,
      mongooseError: this.extractMongooseErrorDetails(exception),
    };

    this.logger.error(
      `Mongoose Error: ${exception.name} - ${exception.message}`,
      logContext,
    );

    response.status(status).json(errorResponse);
  }

  private handleMongooseError(exception: MongooseError): ErrorHandlingResult {
    switch (exception.name) {
      case 'CastError':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Invalid ID format provided',
          error: 'Bad Request',
        };

      case 'ValidationError':
        const validationError = exception as MongooseValidationError;
        const messages = Object.values(validationError.errors).map(
          (err: ValidationErrorDetails) => err.message,
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

  private extractMongooseErrorDetails(
    exception: MongooseError,
  ): MongooseErrorDetails {
    const baseDetails: MongooseErrorDetails = {
      name: exception.name,
    };

    if (this.isCastError(exception)) {
      return {
        ...baseDetails,
        path: exception.path,
        value: exception.value,
        kind: exception.kind,
        model: exception.model?.modelName,
      };
    }

    if (this.isDocumentNotFoundError(exception)) {
      return {
        ...baseDetails,
        query: exception.query,
        model: exception.model.modelName,
      };
    }

    if (this.isVersionError(exception)) {
      return {
        ...baseDetails,
        version: exception.version,
        modifiedPaths: exception.modifiedPaths,
      };
    }

    if (this.isOverwriteModelError(exception)) {
      return {
        ...baseDetails,
        model: exception.model,
      };
    }

    if (this.isMissingSchemaError(exception)) {
      return {
        ...baseDetails,
        model: exception.model,
      };
    }

    if (this.isDivergentArrayError(exception)) {
      return {
        ...baseDetails,
        path: exception.path,
      };
    }

    return baseDetails;
  }

  private isCastError(error: MongooseError): error is MongooseCastError {
    return error.name === 'CastError';
  }

  private isValidationError(
    error: MongooseError,
  ): error is MongooseValidationError {
    return error.name === 'ValidationError';
  }

  private isDocumentNotFoundError(
    error: MongooseError,
  ): error is MongooseDocumentNotFoundError {
    return error.name === 'DocumentNotFoundError';
  }

  private isVersionError(error: MongooseError): error is MongooseVersionError {
    return error.name === 'VersionError';
  }

  private isOverwriteModelError(
    error: MongooseError,
  ): error is MongooseOverwriteModelError {
    return error.name === 'OverwriteModelError';
  }

  private isMissingSchemaError(
    error: MongooseError,
  ): error is MongooseMissingSchemaError {
    return error.name === 'MissingSchemaError';
  }

  private isDivergentArrayError(
    error: MongooseError,
  ): error is MongooseDivergentArrayError {
    return error.name === 'DivergentArrayError';
  }
}
