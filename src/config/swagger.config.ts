import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

/**
 * Configuration class for Swagger documentation setup
 */
export class SwaggerConfig {
  /**
   * Creates and configures Swagger documentation for the application
   * @param app - The NestJS application instance
   */
  static setup(app: INestApplication): void {
    const config = new DocumentBuilder()
      .setTitle('Image Processing API')
      .setDescription('API REST for image processing and task management')
      .setVersion('1.0')
      .addTag('tasks', 'Task management endpoints')
      .addTag('images', 'Image processing endpoints')
      .addTag('health', 'Health check endpoints')
      .addServer(
        process.env.API_URL || 'http://localhost:3000',
        'Development server',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
      },
    });

    console.log('Documentación de Swagger configurada correctamente');
  }

  /**
   * Returns the Swagger documentation path
   */
  static getDocsPath(): string {
    return 'api/docs';
  }
}
