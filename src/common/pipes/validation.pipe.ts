import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
  Logger,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

@Injectable()
export class CustomValidationPipe implements PipeTransform<any> {
  private readonly logger = new Logger(CustomValidationPipe.name);

  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToClass(metatype, value);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validateCustomDecorators: true,
    });

    if (errors.length > 0) {
      const errorMessages = this.formatErrors(errors);

      this.logger.warn('Validation failed', {
        errors: errorMessages,
        input: value,
        metatype: metatype.name,
      });

      throw new BadRequestException({
        message: 'Validation failed',
        errors: errorMessages,
        statusCode: 400,
      });
    }

    return object;
  }

  private toValidate(metatype: any): boolean {
    const types: any[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private formatErrors(errors: any[]): string[] {
    return errors
      .map((error) => {
        const constraints = error.constraints;
        const messages = Object.values(constraints || {}) as string[];

        if (error.children && error.children.length > 0) {
          const childMessages = this.formatErrors(error.children);
          return childMessages.map((msg) => `${error.property}.${msg}`);
        }

        return messages.map((msg) => `${error.property}: ${msg}`);
      })
      .flat();
  }
}
