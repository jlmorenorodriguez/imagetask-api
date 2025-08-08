import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { Request, Response, NextFunction } from 'express';

/**
 * Configuration class for CORS settings
 */
export class CorsConfig {
  /**
   * Returns the CORS configuration options
   */
  static getOptions(): CorsOptions {
    return {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      credentials: true,
    };
  }

  /**
   * Security headers middleware function
   */
  static securityHeadersMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  }
}
