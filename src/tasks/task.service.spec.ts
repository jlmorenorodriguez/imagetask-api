import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bull';
import { TasksService } from './tasks.service';
import { Task, TaskStatus } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';

describe('TasksService', () => {
  let service: TasksService;
  let mockTaskModel: any;
  let mockQueue: any;

  const mockTask = {
    _id: '507f1f77bcf86cd799439011',
    originalPath: '/test/image.jpg',
    price: 25.5,
    status: TaskStatus.PENDING,
    images: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    // Create a proper mock constructor with static methods
    const mockTaskInstance = {
      ...mockTask,
      save: jest.fn().mockResolvedValue({
        ...mockTask,
        _id: { toString: () => '507f1f77bcf86cd799439011' },
      }),
    };

    mockTaskModel = jest.fn(() => mockTaskInstance);

    // Add static methods to the mock constructor
    mockTaskModel.find = jest.fn();
    mockTaskModel.findById = jest.fn();
    mockTaskModel.findByIdAndUpdate = jest.fn();

    // Mock Bull Queue
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: getModelToken(Task.name),
          useValue: mockTaskModel,
        },
        {
          provide: getQueueToken('image-processing'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTask', () => {
    it('should create a task with local path', async () => {
      const createTaskDto: CreateTaskDto = {
        originalPath: '/test/image.jpg',
      };

      const result = await service.createTask(createTaskDto);

      expect(result).toEqual({
        taskId: '507f1f77bcf86cd799439011',
        status: TaskStatus.PENDING,
        price: expect.any(Number),
      });

      expect(result.price).toBeGreaterThanOrEqual(5);
      expect(result.price).toBeLessThanOrEqual(50);
      expect(mockQueue.add).toHaveBeenCalledWith('process-image', {
        taskId: '507f1f77bcf86cd799439011',
        originalPath: '/test/image.jpg',
      });
    });

    it('should create a task with URL', async () => {
      const createTaskDto: CreateTaskDto = {
        originalPath: 'https://example.com/image.jpg',
      };

      const result = await service.createTask(createTaskDto);

      expect(result.taskId).toBe('507f1f77bcf86cd799439011');
      expect(mockQueue.add).toHaveBeenCalledWith('process-image-from-url', {
        taskId: '507f1f77bcf86cd799439011',
        imageUrl: 'https://example.com/image.jpg',
      });
    });

    it('should handle creation errors', async () => {
      const createTaskDto: CreateTaskDto = {
        originalPath: '/test/image.jpg',
      };

      // Create a temporary mock that throws on save
      const errorInstance = {
        save: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      mockTaskModel.mockReturnValueOnce(errorInstance);

      await expect(service.createTask(createTaskDto)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('getTaskById', () => {
    it('should return task when found', async () => {
      const taskId = '507f1f77bcf86cd799439011';
      const mockFoundTask = {
        ...mockTask,
        _id: { toString: () => taskId },
      };

      mockTaskModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockFoundTask),
      });

      const result = await service.getTaskById(taskId);

      expect(result).toEqual({
        taskId,
        status: TaskStatus.PENDING,
        price: 25.5,
        images: [],
        errorMessage: undefined,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should return null when task not found', async () => {
      const taskId = '507f1f77bcf86cd799439011';

      mockTaskModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.getTaskById(taskId);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const taskId = '507f1f77bcf86cd799439011';

      mockTaskModel.findById.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(service.getTaskById(taskId)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('getAllTasks', () => {
    it('should return all tasks sorted by creation date', async () => {
      const mockTasks = [
        { ...mockTask, _id: { toString: () => '1' } },
        { ...mockTask, _id: { toString: () => '2' } },
      ];

      mockTaskModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockTasks),
        }),
      });

      const result = await service.getAllTasks();

      expect(result).toHaveLength(2);
      expect(result[0].taskId).toBe('1');
      expect(result[1].taskId).toBe('2');
      expect(mockTaskModel.find).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      mockTaskModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.getAllTasks();

      expect(result).toEqual([]);
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status successfully', async () => {
      const taskId = '507f1f77bcf86cd799439011';
      const images = [{ resolution: '1024', path: '/output/test.jpg' }];

      mockTaskModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await service.updateTaskStatus(taskId, TaskStatus.COMPLETED, images);

      expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith(taskId, {
        status: TaskStatus.COMPLETED,
        images,
        updatedAt: expect.any(Date),
      });
    });

    it('should update task with error message', async () => {
      const taskId = '507f1f77bcf86cd799439011';
      const errorMessage = 'Processing failed';

      mockTaskModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await service.updateTaskStatus(
        taskId,
        TaskStatus.FAILED,
        undefined,
        errorMessage,
      );

      expect(mockTaskModel.findByIdAndUpdate).toHaveBeenCalledWith(taskId, {
        status: TaskStatus.FAILED,
        errorMessage,
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('URL validation', () => {
    it('should detect valid URLs', () => {
      // Test the private method using proper type casting
      const serviceInstance = service as any;

      expect(serviceInstance.isValidUrl('https://example.com/image.jpg')).toBe(
        true,
      );
      expect(serviceInstance.isValidUrl('http://example.com/image.jpg')).toBe(
        true,
      );
      expect(serviceInstance.isValidUrl('/local/path/image.jpg')).toBe(false);
      expect(serviceInstance.isValidUrl('ftp://example.com/image.jpg')).toBe(
        false,
      );
    });
  });
});
