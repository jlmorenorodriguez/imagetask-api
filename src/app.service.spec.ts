import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return health check information', () => {
      const result = service.getHealth();

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('environment');

      expect(result.message).toBe(
        'Image Processing API is running successfully',
      );
      expect(typeof result.timestamp).toBe('string');
      expect(result.environment).toBe('test'); // from test environment
    });

    it('should return current timestamp', () => {
      const beforeCall = Date.now();
      const result = service.getHealth();
      const afterCall = Date.now();

      const resultTimestamp = new Date(result.timestamp).getTime();

      expect(resultTimestamp).toBeGreaterThanOrEqual(beforeCall);
      expect(resultTimestamp).toBeLessThanOrEqual(afterCall);
    });

    it('should return environment from NODE_ENV', () => {
      const originalEnv = process.env.NODE_ENV;

      // Test with different environment
      process.env.NODE_ENV = 'production';
      const result = service.getHealth();
      expect(result.environment).toBe('production');

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should default to development environment when NODE_ENV is not set', () => {
      const originalEnv = process.env.NODE_ENV;

      // Temporarily unset NODE_ENV
      delete process.env.NODE_ENV;
      const result = service.getHealth();
      expect(result.environment).toBe('development');

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should return valid ISO timestamp format', () => {
      const result = service.getHealth();

      // Check if timestamp is valid ISO string
      const date = new Date(result.timestamp);
      expect(date.toISOString()).toBe(result.timestamp);
      expect(result.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });
});
