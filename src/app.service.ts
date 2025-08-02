import { Injectable } from '@nestjs/common';

interface HealthResponse {
  message: string;
  timestamp: string;
  environment: string;
}

@Injectable()
export class AppService {
  getHealth(): HealthResponse {
    return {
      message: 'Image Processing API is running successfully',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
