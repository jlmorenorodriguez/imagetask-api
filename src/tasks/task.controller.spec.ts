import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskStatus } from './entities/task.entity';

describe('TasksController', () => {
  let controller: TasksController;
  let service: TasksService;

  const mockTasksService = {
    createTask: jest.fn(),
    getTaskById: jest.fn(),
    getAllTasks: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        {
          provide: TasksService,
          useValue: mockTasksService,
        },
      ],
    }).compile();

    controller = module.get<TasksController>(TasksController);
    service = module.get<TasksService>(TasksService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createTask', () => {
    it('should create a new task successfully', async () => {
      const createTaskDto: CreateTaskDto = {
        originalPath: '/test/image.jpg',
      };

      const expectedResult = {
        taskId: '507f1f77bcf86cd799439011',
        status: TaskStatus.PENDING,
        price: 25.5,
      };

      mockTasksService.createTask.mockResolvedValue(expectedResult);

      const result = await controller.createTask(createTaskDto);

      expect(result).toEqual(expectedResult);
      expect(service.createTask).toHaveBeenCalledWith(createTaskDto);
    });

    it('should handle service errors', async () => {
      const createTaskDto: CreateTaskDto = {
        originalPath: '/test/image.jpg',
      };

      mockTasksService.createTask.mockRejectedValue(new Error('Service error'));

      await expect(controller.createTask(createTaskDto)).rejects.toThrow(
        'Service error',
      );
    });
  });

  describe('getTaskById', () => {
    it('should return task when found', async () => {
      const taskId = '507f1f77bcf86cd799439011';
      const expectedTask = {
        taskId,
        status: TaskStatus.COMPLETED,
        price: 25.5,
        images: [
          { resolution: '1024', path: '/output/test/1024/hash.jpg' },
          { resolution: '800', path: '/output/test/800/hash.jpg' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTasksService.getTaskById.mockResolvedValue(expectedTask);

      const result = await controller.getTaskById(taskId);

      expect(result).toEqual(expectedTask);
      expect(service.getTaskById).toHaveBeenCalledWith(taskId);
    });

    it('should throw NotFoundException when task not found', async () => {
      const taskId = '507f1f77bcf86cd799439011';

      mockTasksService.getTaskById.mockRejectedValue(
        new NotFoundException(`Task not found: ${taskId}`),
      );

      await expect(controller.getTaskById(taskId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.getTaskById(taskId)).rejects.toThrow(
        `Task not found: ${taskId}`,
      );
    });

    it('should handle service errors', async () => {
      const taskId = '507f1f77bcf86cd799439011';

      mockTasksService.getTaskById.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.getTaskById(taskId)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('getAllTasks', () => {
    it('should return all tasks', async () => {
      const expectedTasks = [
        {
          taskId: '507f1f77bcf86cd799439011',
          status: TaskStatus.COMPLETED,
          price: 25.5,
          images: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          taskId: '507f1f77bcf86cd799439012',
          status: TaskStatus.PENDING,
          price: 15.0,
          images: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockTasksService.getAllTasks.mockResolvedValue(expectedTasks);

      const result = await controller.getAllTasks();

      expect(result).toEqual(expectedTasks);
      expect(service.getAllTasks).toHaveBeenCalled();
    });

    it('should return empty array when no tasks exist', async () => {
      mockTasksService.getAllTasks.mockResolvedValue([]);

      const result = await controller.getAllTasks();

      expect(result).toEqual([]);
    });

    it('should handle service errors', async () => {
      mockTasksService.getAllTasks.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.getAllTasks()).rejects.toThrow('Database error');
    });
  });
});
