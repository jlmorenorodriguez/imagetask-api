import { ValidationPipeOptions } from '@nestjs/common';

/**
 * Configuration class for global validation pipe settings
 */
export class ValidationConfig {
  /**
   * Returns the validation pipe configuration options
   */
  static getOptions(): ValidationPipeOptions {
    return {
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: process.env.NODE_ENV === 'production',
      validationError: {
        target: false,
        value: false,
      },
    };
  }
}
