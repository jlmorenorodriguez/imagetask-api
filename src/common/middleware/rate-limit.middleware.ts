import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Socket } from 'net';

/**
 * Interface for rate limit record stored per IP
 */
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * Interface for rate limit store (IP-based)
 */
interface RateLimitStore {
  [ip: string]: RateLimitRecord;
}

/**
 * Interface for HTTP exception response with retry information
 */
interface RateLimitExceptionResponse {
  statusCode: number;
  message: string;
  retryAfter: number;
}

/**
 * Interface for Express socket with nested socket property
 */
interface SocketWithNestedSocket extends Socket {
  socket?: Socket;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly store: RateLimitStore = {};
  private readonly windowMs: number = 15 * 60 * 1000; // 15 minutes
  private readonly max: number = 100; // limit each IP to 100 requests per windowMs
  private readonly defaultIp: string = '127.0.0.1';

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

      this.setRateLimitHeaders(res, {
        limit: this.max,
        remaining: 0,
        reset: record.resetTime,
        retryAfter: remainingTime,
      });

      const exceptionResponse: RateLimitExceptionResponse = {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many requests, please try again later',
        retryAfter: remainingTime,
      };

      throw new HttpException(exceptionResponse, HttpStatus.TOO_MANY_REQUESTS);
    }

    // Increment counter
    record.count++;

    // Set rate limit headers
    this.setRateLimitHeaders(res, {
      limit: this.max,
      remaining: this.max - record.count,
      reset: record.resetTime,
    });

    next();
  }

  private getClientIp(req: Request): string {
    // Try to get IP from various sources in order of preference
    const ipSources: (string | undefined)[] = [
      req.ip,
      req.connection?.remoteAddress,
      req.socket?.remoteAddress,
      // Safely access nested socket property
      (req.connection as SocketWithNestedSocket)?.socket?.remoteAddress,
    ];

    for (const ip of ipSources) {
      if (ip && typeof ip === 'string') {
        return ip;
      }
    }

    return this.defaultIp;
  }

  private cleanup(cutoff: number): void {
    for (const ip in this.store) {
      if (Object.prototype.hasOwnProperty.call(this.store, ip)) {
        const record = this.store[ip];
        if (record.resetTime < cutoff) {
          delete this.store[ip];
        }
      }
    }
  }

  private setRateLimitHeaders(
    res: Response,
    options: {
      limit: number;
      remaining: number;
      reset: number;
      retryAfter?: number;
    },
  ): void {
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': options.limit.toString(),
      'X-RateLimit-Remaining': options.remaining.toString(),
      'X-RateLimit-Reset': options.reset.toString(),
    };

    if (options.retryAfter !== undefined) {
      headers['Retry-After'] = options.retryAfter.toString();
    }

    res.set(headers);
  }
}
