import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
  Logger,
  Type,
} from '@nestjs/common';
import { validate, ValidationError, ValidatorOptions } from 'class-validator';
import { plainToClass, ClassConstructor } from 'class-transformer';

/**
 * Interface for validation error response
 */
interface ValidationErrorResponse {
  message: string;
  errors: string[];
  statusCode: number;
}

/**
 * Type for basic JavaScript constructor types
 */
type BasicType =
  | StringConstructor
  | BooleanConstructor
  | NumberConstructor
  | ArrayConstructor
  | ObjectConstructor;

@Injectable()
export class CustomValidationPipe implements PipeTransform<unknown, unknown> {
  private readonly logger = new Logger(CustomValidationPipe.name);

  async transform(
    value: unknown,
    { metatype }: ArgumentMetadata,
  ): Promise<unknown> {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToClass(metatype as ClassConstructor<object>, value, {
      enableImplicitConversion: true,
    });

    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      validateCustomDecorators: true,
    } as ValidatorOptions);

    if (errors.length > 0) {
      const errorMessages = this.formatErrors(errors);

      this.logger.warn('Validation failed', {
        errors: errorMessages,
        input: value,
        metatype: metatype.name,
      });

      const errorResponse: ValidationErrorResponse = {
        message: 'Validation failed',
        errors: errorMessages,
        statusCode: 400,
      };

      throw new BadRequestException(errorResponse);
    }

    return object;
  }

  private toValidate(metatype: Type<unknown> | undefined): boolean {
    const types: BasicType[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype as BasicType);
  }

  private formatErrors(errors: ValidationError[]): string[] {
    return errors
      .map((error: ValidationError) => {
        const constraints = error.constraints;
        const messages = Object.values(constraints || {}) as string[];

        if (error.children && error.children.length > 0) {
          const childMessages = this.formatErrors(error.children);
          return childMessages.map((msg: string) => `${error.property}.${msg}`);
        }

        return messages.map((msg: string) => `${error.property}: ${msg}`);
      })
      .flat();
  }
}
