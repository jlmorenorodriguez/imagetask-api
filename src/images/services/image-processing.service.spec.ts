import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ImageProcessingProcessor } from '../processors/image-processing.processor';
import { ImageProcessingService } from './image-processing.service';
import { Task, TaskStatus } from '../../tasks/entities/task.entity';
import { Job } from 'bull';

describe('ImageProcessingProcessor', () => {
  let processor: ImageProcessingProcessor;
  let imageProcessingService: ImageProcessingService;
  let mockTaskModel: any;

  const mockJob = {
    data: {
      taskId: 'test-task-id',
      originalPath: '/test/image.jpg',
    },
  } as Job;

  const mockUrlJob = {
    data: {
      taskId: 'test-task-id',
      imageUrl: 'https://example.com/image.jpg',
    },
  } as Job;

  beforeEach(async () => {
    mockTaskModel = {
      findByIdAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      }),
    };

    const mockImageProcessingService = {
      processImageFromPath: jest.fn(),
      processImageFromUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImageProcessingProcessor,
        {
          provide: getModelToken(Task.name),
          useValue: mockTaskModel,
        },
        {
          provide: ImageProcessingService,
          useValue: mockImageProcessingService,
        },
      ],
    }).compile();

    processor = module.get<ImageProcessingProcessor>(ImageProcessingProcessor);
    imageProcessingService = module.get<ImageProcessingService>(
      ImageProcessingService,
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('handleImageProcessing', () => {
    it('should process image successfully from local path', async () => {
      const mockResult = {
        success: true,
        images: [
          { resolution: '1024', path: '/output/test/1024/hash.jpg' },
          { resolution: '800', path: '/output/test/800/hash.jpg' },
        ],
      };

      jest
        .spyOn(imageProcessingService, 'processImageFromPath')
        .mockResolvedValue(mockResult);

      await processor.handleImageProcessing(mockJob);

      expect(imageProcessingService.processImageFromPath).toHaveBeenCalledWith(
        'test-task-id',
        '/test/image.jpg',
      );

      // Check that task status was updated to processing first
      expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'test-task-id',
        {
          status: TaskStatus.PROCESSING,
          updatedAt: expect.any(Date),
        },
      );

      // Check final update to completed
      expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'test-task-id',
        {
          status: TaskStatus.COMPLETED,
          images: mockResult.images,
          updatedAt: expect.any(Date),
        },
      );
    });

    it('should handle processing failure', async () => {
      const mockResult = {
        success: false,
        error: 'Image processing failed',
      };

      jest
        .spyOn(imageProcessingService, 'processImageFromPath')
        .mockResolvedValue(mockResult);

      await processor.handleImageProcessing(mockJob);

      expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'test-task-id',
        {
          status: TaskStatus.FAILED,
          errorMessage: 'Image processing failed',
          updatedAt: expect.any(Date),
        },
      );
    });

    it('should handle unexpected errors', async () => {
      jest
        .spyOn(imageProcessingService, 'processImageFromPath')
        .mockRejectedValue(new Error('Unexpected service error'));

      await processor.handleImageProcessing(mockJob);

      expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'test-task-id',
        {
          status: TaskStatus.FAILED,
          errorMessage: 'Unexpected error: Unexpected service error',
          updatedAt: expect.any(Date),
        },
      );
    });
  });

  describe('handleImageProcessingFromUrl', () => {
    it('should process image successfully from URL', async () => {
      const mockResult = {
        success: true,
        images: [
          { resolution: '1024', path: '/output/test/1024/hash.jpg' },
          { resolution: '800', path: '/output/test/800/hash.jpg' },
        ],
      };

      jest
        .spyOn(imageProcessingService, 'processImageFromUrl')
        .mockResolvedValue(mockResult);

      await processor.handleImageProcessingFromUrl(mockUrlJob);

      expect(imageProcessingService.processImageFromUrl).toHaveBeenCalledWith(
        'test-task-id',
        'https://example.com/image.jpg',
      );

      // Check processing and completed status updates
      expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'test-task-id',
        {
          status: TaskStatus.PROCESSING,
          updatedAt: expect.any(Date),
        },
      );

      expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'test-task-id',
        {
          status: TaskStatus.COMPLETED,
          images: mockResult.images,
          updatedAt: expect.any(Date),
        },
      );
    });

    it('should handle URL processing failure', async () => {
      const mockResult = {
        success: false,
        error: 'URL download failed',
      };

      jest
        .spyOn(imageProcessingService, 'processImageFromUrl')
        .mockResolvedValue(mockResult);

      await processor.handleImageProcessingFromUrl(mockUrlJob);

      expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'test-task-id',
        {
          status: TaskStatus.FAILED,
          errorMessage: 'URL download failed',
          updatedAt: expect.any(Date),
        },
      );
    });

    it('should handle unexpected URL processing errors', async () => {
      jest
        .spyOn(imageProcessingService, 'processImageFromUrl')
        .mockRejectedValue(new Error('Network timeout'));

      await processor.handleImageProcessingFromUrl(mockUrlJob);

      expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'test-task-id',
        {
          status: TaskStatus.FAILED,
          errorMessage: 'Unexpected error: Network timeout',
          updatedAt: expect.any(Date),
        },
      );
    });
  });

  describe('updateTaskStatus (private method)', () => {
    it('should update task status with images', async () => {
      const images = [{ resolution: '1024', path: '/test/path.jpg' }];

      // Access private method for testing
      await (processor as any).updateTaskStatus(
        'task-123',
        TaskStatus.COMPLETED,
        images,
      );

      expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith('task-123', {
        status: TaskStatus.COMPLETED,
        images,
        updatedAt: expect.any(Date),
      });
    });

    it('should update task status with error message', async () => {
      const errorMessage = 'Processing failed';

      await (processor as any).updateTaskStatus(
        'task-123',
        TaskStatus.FAILED,
        undefined,
        errorMessage,
      );

      expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith('task-123', {
        status: TaskStatus.FAILED,
        errorMessage,
        updatedAt: expect.any(Date),
      });
    });

    it('should handle database update errors', async () => {
      mockTaskModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(
        (processor as any).updateTaskStatus('task-123', TaskStatus.COMPLETED),
      ).rejects.toThrow('Database error');
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors during processing', async () => {
      mockTaskModel.findByIdAndUpdate.mockReturnValue({
        exec: jest
          .fn()
          .mockRejectedValue(new Error('Database connection lost')),
      });

      const mockResult = {
        success: true,
        images: [{ resolution: '1024', path: '/test.jpg' }],
      };

      jest
        .spyOn(imageProcessingService, 'processImageFromPath')
        .mockResolvedValue(mockResult);

      // Should throw when database update fails during status update
      await expect(processor.handleImageProcessing(mockJob)).rejects.toThrow(
        'Database connection lost',
      );

      // The image processing service should not be called because the error occurs during status update
      expect(
        imageProcessingService.processImageFromPath,
      ).not.toHaveBeenCalled();
    });

    it('should handle null or undefined job data', async () => {
      const emptyJob = { data: null } as any;

      // Should throw when job data is null/undefined
      await expect(processor.handleImageProcessing(emptyJob)).rejects.toThrow();
    });
  });
});
