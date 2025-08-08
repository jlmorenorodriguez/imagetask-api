import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';

// Configuration imports
import { SwaggerConfig } from './config/swagger.config';
import { CorsConfig } from './config/cors.config';
import { ValidationConfig } from './config/validation.config';
import { AppConfig } from './config/app.config';

/**
 * Bootstrap function to initialize and configure the NestJS application
 */
async function bootstrap() {
  try {
    // Create NestJS application instance
    const app = await NestFactory.create(AppModule);

    // Configure global exception filters
    app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

    // Configure rate limiting middleware
    app.use(new RateLimitMiddleware().use.bind(new RateLimitMiddleware()));

    // Configure global validation pipe
    app.useGlobalPipes(new ValidationPipe(ValidationConfig.getOptions()));

    // Configure Swagger documentation
    SwaggerConfig.setup(app);

    // Configure CORS
    app.enableCors(CorsConfig.getOptions());

    // Configure security headers
    app.use(CorsConfig.securityHeadersMiddleware);

    // Start the application
    const port = AppConfig.getPort();
    await app.listen(port);

    // Log startup information
    AppConfig.logStartupInfo();
  } catch (error) {
    console.error('Error starting app:', error);
    process.exit(1);
  }
}

// Start the application
bootstrap();
