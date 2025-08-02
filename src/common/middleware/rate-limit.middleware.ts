import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private store: RateLimitStore = {};
  private readonly windowMs = 15 * 60 * 1000; // 15 minutes
  private readonly max = 100; // limit each IP to 100 requests per windowMs

  use(req: Request, res: Response, next: NextFunction): void {
    const ip = this.getClientIp(req);
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Clean up old entries
    this.cleanup(windowStart);

    // Get or create record for this IP
    if (!this.store[ip]) {
      this.store[ip] = {
        count: 0,
        resetTime: now + this.windowMs,
      };
    }

    const record = this.store[ip];

    // Reset if window has passed
    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + this.windowMs;
    }

    // Check if limit exceeded
    if (record.count >= this.max) {
      const remainingTime = Math.ceil((record.resetTime - now) / 1000);

      res.set({
        'X-RateLimit-Limit': this.max.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': record.resetTime.toString(),
        'Retry-After': remainingTime.toString(),
      });

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests, please try again later',
          retryAfter: remainingTime,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment counter
    record.count++;

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': this.max.toString(),
      'X-RateLimit-Remaining': (this.max - record.count).toString(),
      'X-RateLimit-Reset': record.resetTime.toString(),
    });

    next();
  }

  private getClientIp(req: Request): string {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection as any)?.socket?.remoteAddress ||
      '127.0.0.1'
    );
  }

  private cleanup(cutoff: number): void {
    for (const ip in this.store) {
      if (this.store[ip].resetTime < cutoff) {
        delete this.store[ip];
      }
    }
  }
}
