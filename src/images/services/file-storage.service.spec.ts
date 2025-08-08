import { Test, TestingModule } from '@nestjs/testing';
import { FileStorageService } from './file-storage.service';
import { promises as fs } from 'fs';
import * as path from 'path';

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    unlink: jest.fn(),
    rmdir: jest.fn(),
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('FileStorageService', () => {
  let service: FileStorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FileStorageService],
    }).compile();

    service = module.get<FileStorageService>(FileStorageService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ensureDirectoryExists', () => {
    it('should not create directory if it exists', async () => {
      const dirPath = '/test/directory';
      mockFs.access.mockResolvedValue(undefined);

      await service.ensureDirectoryExists(dirPath);

      expect(mockFs.access).toHaveBeenCalledWith(dirPath);
      expect(mockFs.mkdir).not.toHaveBeenCalled();
    });

    it('should create directory if it does not exist', async () => {
      const dirPath = '/test/directory';
      mockFs.access.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockResolvedValue(undefined);

      await service.ensureDirectoryExists(dirPath);

      expect(mockFs.access).toHaveBeenCalledWith(dirPath);
      expect(mockFs.mkdir).toHaveBeenCalledWith(dirPath, { recursive: true });
    });
  });

  describe('generateMd5Hash', () => {
    it('should generate consistent MD5 hash for same buffer', () => {
      const buffer = Buffer.from('test data');
      const hash1 = service.generateMd5Hash(buffer);
      const hash2 = service.generateMd5Hash(buffer);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{32}$/); // 32 character hex string
    });

    it('should generate different hashes for different buffers', () => {
      const buffer1 = Buffer.from('test data 1');
      const buffer2 = Buffer.from('test data 2');

      const hash1 = service.generateMd5Hash(buffer1);
      const hash2 = service.generateMd5Hash(buffer2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('getFileExtension', () => {
    it('should extract extension from filename', () => {
      expect(service.getFileExtension('image.jpg')).toBe('jpg');
      expect(service.getFileExtension('photo.PNG')).toBe('png');
      expect(service.getFileExtension('file.jpeg')).toBe('jpeg');
      expect(service.getFileExtension('document.pdf')).toBe('pdf');
    });

    it('should handle filenames without extension', () => {
      expect(service.getFileExtension('filename')).toBe('');
      expect(service.getFileExtension('')).toBe('');
    });

    it('should handle complex paths', () => {
      expect(service.getFileExtension('/path/to/image.jpg')).toBe('jpg');
      expect(service.getFileExtension('C:\\Windows\\image.PNG')).toBe('png');
    });
  });

  describe('generateOutputPath', () => {
    it('should generate correct output path structure', () => {
      const taskId = 'test-task-123';
      const resolution = '1024';
      const expectedPath = path.join('test-output', taskId, resolution);

      const result = service.generateOutputPath(taskId, resolution);

      expect(result).toBe(expectedPath);
    });
  });

  describe('generateFilePath', () => {
    it('should generate complete file path with MD5 hash', () => {
      const taskId = 'test-task-123';
      const resolution = '1024';
      const md5Hash = 'abcdef123456789';
      const extension = 'jpg';

      const result = service.generateFilePath(
        taskId,
        resolution,
        md5Hash,
        extension,
      );

      const expectedPath = path.join(
        'test-output',
        taskId,
        resolution,
        `${md5Hash}.${extension}`,
      );
      expect(result).toBe(expectedPath);
    });
  });

  describe('saveImage', () => {
    it('should save image successfully', async () => {
      const taskId = 'test-task-123';
      const resolution = '1024';
      const imageBuffer = Buffer.from('fake image data');
      const extension = 'jpg';

      mockFs.access.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await service.saveImage(
        taskId,
        resolution,
        imageBuffer,
        extension,
      );

      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(result).toContain(taskId);
      expect(result).toContain(resolution);
      expect(result).toContain(extension);
    });

    it('should handle save errors', async () => {
      const taskId = 'test-task-123';
      const resolution = '1024';
      const imageBuffer = Buffer.from('fake image data');
      const extension = 'jpg';

      mockFs.access.mockRejectedValue(new Error('Directory not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(
        service.saveImage(taskId, resolution, imageBuffer, extension),
      ).rejects.toThrow('Failed to save image');
    });
  });

  describe('readFile', () => {
    it('should read file successfully', async () => {
      const filePath = '/test/image.jpg';
      const expectedBuffer = Buffer.from('file content');

      mockFs.readFile.mockResolvedValue(expectedBuffer);

      const result = await service.readFile(filePath);

      expect(result).toEqual(expectedBuffer);
      expect(mockFs.readFile).toHaveBeenCalledWith(filePath);
    });

    it('should handle read errors', async () => {
      const filePath = '/test/nonexistent.jpg';

      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(service.readFile(filePath)).rejects.toThrow(
        'Failed to read file',
      );
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      const filePath = '/test/image.jpg';
      mockFs.access.mockResolvedValue(undefined);

      const result = await service.fileExists(filePath);

      expect(result).toBe(true);
      expect(mockFs.access).toHaveBeenCalledWith(filePath);
    });

    it('should return false if file does not exist', async () => {
      const filePath = '/test/nonexistent.jpg';
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const result = await service.fileExists(filePath);

      expect(result).toBe(false);
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const filePath = '/test/image.jpg';
      mockFs.unlink.mockResolvedValue(undefined);

      await service.deleteFile(filePath);

      expect(mockFs.unlink).toHaveBeenCalledWith(filePath);
    });

    it('should handle deletion errors gracefully', async () => {
      const filePath = '/test/nonexistent.jpg';
      mockFs.unlink.mockRejectedValue(new Error('File not found'));

      // Should not throw error
      await expect(service.deleteFile(filePath)).resolves.toBeUndefined();
    });
  });

  describe('cleanupTaskDirectory', () => {
    it('should cleanup task directory successfully', async () => {
      const taskId = 'test-task-123';
      mockFs.rmdir.mockResolvedValue(undefined);

      await service.cleanupTaskDirectory(taskId);

      const expectedPath = path.join('test-output', taskId);
      expect(mockFs.rmdir).toHaveBeenCalledWith(expectedPath, {
        recursive: true,
      });
    });

    it('should handle cleanup errors gracefully', async () => {
      const taskId = 'test-task-123';
      mockFs.rmdir.mockRejectedValue(new Error('Directory not found'));

      // Should not throw error
      await expect(
        service.cleanupTaskDirectory(taskId),
      ).resolves.toBeUndefined();
    });
  });
});
