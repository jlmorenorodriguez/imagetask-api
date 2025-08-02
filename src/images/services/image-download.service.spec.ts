import { Test, TestingModule } from '@nestjs/testing';
import { ImageDownloadService } from './image-download.service';

describe('ImageDownloadService', () => {
  let service: ImageDownloadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImageDownloadService],
    }).compile();

    service = module.get<ImageDownloadService>(ImageDownloadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateImageUrl', () => {
    it('should validate correct HTTPS URLs', () => {
      const result = service.validateImageUrl('https://example.com/image.jpg');
      expect(result.isValid).toBe(true);
    });

    it('should validate correct HTTP URLs', () => {
      const result = service.validateImageUrl('http://example.com/image.png');
      expect(result.isValid).toBe(true);
    });

    it('should reject non-HTTP protocols', () => {
      const result = service.validateImageUrl('ftp://example.com/image.jpg');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Only HTTP and HTTPS URLs are supported');
    });

    it('should handle invalid URLs', () => {
      const result = service.validateImageUrl('not-a-url');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid URL format');
    });

    it('should accept URLs without extension (content-type based)', () => {
      const result = service.validateImageUrl('https://example.com/api/image');
      expect(result.isValid).toBe(true);
    });
  });

  describe('private methods', () => {
    it('should identify valid image content types', () => {
      const service_any = service as any;

      expect(service_any.isValidImageContentType('image/jpeg')).toBe(true);
      expect(service_any.isValidImageContentType('image/png')).toBe(true);
      expect(service_any.isValidImageContentType('image/webp')).toBe(true);
      expect(service_any.isValidImageContentType('application/pdf')).toBe(
        false,
      );
      expect(service_any.isValidImageContentType(undefined)).toBe(false);
    });

    it('should extract extension from URL', () => {
      const service_any = service as any;

      expect(
        service_any.extractExtensionFromUrl('https://example.com/image.jpg'),
      ).toBe('jpg');
      expect(
        service_any.extractExtensionFromUrl('https://example.com/photo.PNG'),
      ).toBe('png');
      expect(
        service_any.extractExtensionFromUrl('https://example.com/api/image'),
      ).toBeNull();
      expect(
        service_any.extractExtensionFromUrl('https://example.com/image.gif'),
      ).toBeNull();
    });

    it('should get extension from content type', () => {
      const service_any = service as any;

      expect(service_any.getExtensionFromContentType('image/jpeg')).toBe('jpg');
      expect(service_any.getExtensionFromContentType('image/png')).toBe('png');
      expect(service_any.getExtensionFromContentType('image/webp')).toBe(
        'webp',
      );
      expect(service_any.getExtensionFromContentType('application/pdf')).toBe(
        'jpg',
      );
      expect(service_any.getExtensionFromContentType(undefined)).toBe('jpg');
    });
  });

  describe('downloadImage', () => {
    it('should handle invalid URLs gracefully', async () => {
      await expect(service.downloadImage('invalid-url')).rejects.toThrow(
        'Invalid URL or request setup',
      );
    });

    it('should handle malformed URLs', async () => {
      await expect(service.downloadImage('://malformed-url')).rejects.toThrow(
        'Invalid URL or request setup',
      );
    });

    it('should handle empty URLs', async () => {
      await expect(service.downloadImage('')).rejects.toThrow(
        'Invalid URL or request setup',
      );
    });

    it('should handle null/undefined URLs', async () => {
      await expect(service.downloadImage(null as any)).rejects.toThrow(
        'Invalid URL or request setup',
      );
      await expect(service.downloadImage(undefined as any)).rejects.toThrow(
        'Invalid URL or request setup',
      );
    });
  });

  describe('configuration', () => {
    it('should have correct max file size', () => {
      const service_any = service as any;
      expect(service_any.maxFileSize).toBe(10485760); // 10MB
    });

    it('should have correct supported formats', () => {
      const service_any = service as any;
      expect(service_any.supportedFormats).toEqual([
        'jpg',
        'jpeg',
        'png',
        'webp',
      ]);
    });
  });

  describe('URL parsing edge cases', () => {
    it('should handle URLs with query parameters', () => {
      const result = service.validateImageUrl(
        'https://example.com/image.jpg?v=1&size=large',
      );
      expect(result.isValid).toBe(true);
    });

    it('should handle URLs with fragments', () => {
      const result = service.validateImageUrl(
        'https://example.com/image.png#section',
      );
      expect(result.isValid).toBe(true);
    });

    it('should handle URLs with ports', () => {
      const result = service.validateImageUrl(
        'https://example.com:8443/image.webp',
      );
      expect(result.isValid).toBe(true);
    });

    it('should handle localhost URLs', () => {
      const result = service.validateImageUrl(
        'http://localhost:3000/image.jpg',
      );
      expect(result.isValid).toBe(true);
    });
  });
});
