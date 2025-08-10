import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  BadRequestException,
  Module,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bull';
import * as request from 'supertest';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { TasksController } from '../src/tasks/tasks.controller';
import { TasksService } from '../src/tasks/tasks.service';
import { Task, TaskStatus } from '../src/tasks/entities/task.entity';
import { ImageProcessingProcessor } from '../src/images/processors/image-processing.processor';

/**
 * Interface for mock task model
 */
interface MockTaskModel {
  find: jest.MockedFunction<any>;
  findById: jest.MockedFunction<any>;
  findByIdAndUpdate: jest.MockedFunction<any>;
  findOne: jest.MockedFunction<any>;
  new (): any;
}

/**
 * Interface for mock queue
 */
interface MockQueue {
  add: jest.MockedFunction<
    (jobType: string, data: any) => Promise<{ id: string }>
  >;
}

/**
 * Interface for mock task object
 */
interface MockTask {
  _id: { toString: () => string };
  originalPath: string;
  price: number;
  status: TaskStatus;
  images: any[];
  createdAt: Date;
  updatedAt: Date;
  save: jest.MockedFunction<() => Promise<any>>;
}


describe('AppController (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let mockTaskModel: MockTaskModel;
  let mockQueue: MockQueue;

  const mockTask: MockTask = {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    originalPath: '/test/image.jpg',
    price: 25.5,
    status: TaskStatus.PENDING,
    images: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    // Mock Mongoose model
    const mockTaskModelConstructor = jest.fn().mockImplementation(() => ({
      ...mockTask,
      save: mockTask.save,
    })) as unknown as MockTaskModel;

    // Mock static methods
    mockTaskModelConstructor.find = jest.fn();
    mockTaskModelConstructor.findById = jest.fn();
    mockTaskModelConstructor.findByIdAndUpdate = jest.fn();
    mockTaskModelConstructor.findOne = jest.fn();

    mockTaskModel = mockTaskModelConstructor;

    // Mock Bull Queue
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    };

    moduleFixture = await Test.createTestingModule({
      controllers: [AppController, TasksController],
      providers: [
        AppService,
        TasksService,
        {
          provide: getModelToken(Task.name),
          useValue: mockTaskModel,
        },
        {
          provide: getQueueToken('image-processing'),
          useValue: mockQueue,
        },
        {
          provide: ImageProcessingProcessor,
          useValue: {
            handleImageProcessing: jest.fn(),
            handleImageProcessingFromUrl: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply validation pipe with proper error handling
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        disableErrorMessages: false,
        validationError: {
          target: false,
          value: false,
        },
        exceptionFactory: (errors) => {
          const messages = errors.flatMap((error) => {
            return error.constraints ? Object.values(error.constraints) : [];
          });
          return new BadRequestException({
            message: 'Validation failed',
            errors: messages,
            statusCode: 400,
          });
        },
      }),
    );

    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    if (moduleFixture) {
      await moduleFixture.close();
    }
  });

  describe('Health Check', () => {
    it('/ (GET)', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('environment');
          expect(res.body.message).toBe(
            'Image Processing API is running successfully',
          );
        });
    });
  });

  describe('Tasks API', () => {
    describe('POST /tasks', () => {
      it('should create a new task with local path', () => {
        mockTask.save.mockResolvedValue(mockTask);

        return request(app.getHttpServer())
          .post('/tasks')
          .send({ originalPath: '/test/image.jpg' })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('taskId');
            expect(res.body).toHaveProperty('status', TaskStatus.PENDING);
            expect(res.body).toHaveProperty('price');
            expect(res.body.price).toBeGreaterThanOrEqual(5);
            expect(res.body.price).toBeLessThanOrEqual(50);
          });
      });

      it('should create a new task with URL', () => {
        mockTask.save.mockResolvedValue(mockTask);

        return request(app.getHttpServer())
          .post('/tasks')
          .send({ originalPath: 'https://example.com/image.jpg' })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('taskId');
            expect(res.body).toHaveProperty('status', TaskStatus.PENDING);
            expect(res.body).toHaveProperty('price');
          });
      });

      it('should validate required fields', async () => {
        const response = await request(app.getHttpServer())
          .post('/tasks')
          .send({})
          .expect(400);

        // Handle flexible response structure
        if (response.body.message === 'Validation failed') {
          expect(response.body).toHaveProperty('errors');
          expect(Array.isArray(response.body.errors)).toBe(true);
        } else {
          expect(response.body).toHaveProperty('message');
          expect(Array.isArray(response.body.message)).toBe(true);
        }
      });

      it('should reject empty originalPath', () => {
        return request(app.getHttpServer())
          .post('/tasks')
          .send({ originalPath: '' })
          .expect(400);
      });

      it('should reject non-string originalPath', () => {
        return request(app.getHttpServer())
          .post('/tasks')
          .send({ originalPath: 123 })
          .expect(400);
      });
    });

    describe('GET /tasks/:taskId', () => {
      it('should return task details when found', () => {
        const taskResponse = {
          _id: mockTask._id,
          originalPath: mockTask.originalPath,
          price: mockTask.price,
          status: TaskStatus.COMPLETED,
          images: [
            { resolution: '1024', path: '/output/test/1024/hash.jpg' },
            { resolution: '800', path: '/output/test/800/hash.jpg' },
          ],
          createdAt: mockTask.createdAt,
          updatedAt: mockTask.updatedAt,
        };

        mockTaskModel.findOne.mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(taskResponse),
          }),
        });

        return request(app.getHttpServer())
          .get('/tasks/507f1f77bcf86cd799439011')
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('taskId');
            expect(res.body).toHaveProperty('status');
            expect(res.body).toHaveProperty('price');
            expect(res.body).toHaveProperty('images');
            expect(res.body).toHaveProperty('createdAt');
            expect(res.body).toHaveProperty('updatedAt');
            expect(Array.isArray(res.body.images)).toBe(true);
            expect(res.body.images).toHaveLength(2);
          });
      });

      it('should return 404 when task not found', () => {
        mockTaskModel.findOne.mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          }),
        });

        return request(app.getHttpServer())
          .get('/tasks/507f1f77bcf86cd799439011')
          .expect(404)
          .expect((res) => {
            expect(res.body).toHaveProperty('message');
            expect(res.body.message).toContain('not found');
          });
      });

      it('should return 400 for invalid ObjectId format', () => {
        return request(app.getHttpServer())
          .get('/tasks/invalid-id')
          .expect(400)
          .expect((res) => {
            expect(res.body).toHaveProperty('message');
            expect(res.body.message).toContain('Invalid format ID');
          });
      });
    });

    describe('GET /tasks', () => {
      it('should return all tasks', () => {
        const mockTasks = [
          {
            _id: { toString: () => '507f1f77bcf86cd799439011' },
            originalPath: '/test/image1.jpg',
            price: 25.5,
            status: TaskStatus.COMPLETED,
            images: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            _id: { toString: () => '507f1f77bcf86cd799439012' },
            originalPath: '/test/image2.jpg',
            price: 30.0,
            status: TaskStatus.PENDING,
            images: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        mockTaskModel.find.mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockTasks),
          }),
        });

        return request(app.getHttpServer())
          .get('/tasks')
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(2);
            res.body.forEach((task: unknown) => {
              const typedTask = task as Record<string, unknown>;
              expect(typedTask).toHaveProperty('taskId');
              expect(typedTask).toHaveProperty('status');
              expect(typedTask).toHaveProperty('price');
              expect(typedTask).toHaveProperty('createdAt');
              expect(typedTask).toHaveProperty('updatedAt');
            });
          });
      });

      it('should return empty array when no tasks exist', () => {
        mockTaskModel.find.mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        });

        return request(app.getHttpServer())
          .get('/tasks')
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(0);
          });
      });
    });

    describe('Error Handling', () => {
      it('should handle database connection errors gracefully', () => {
        mockTaskModel.find.mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest
              .fn()
              .mockRejectedValue(new Error('Database connection failed')),
          }),
        });

        return request(app.getHttpServer()).get('/tasks').expect(500);
      });

      it('should handle queue connection errors', () => {
        mockQueue.add.mockRejectedValue(new Error('Redis connection failed'));
        mockTask.save.mockResolvedValue(mockTask);

        return request(app.getHttpServer())
          .post('/tasks')
          .send({ originalPath: '/test/image.jpg' })
          .expect(500);
      });
    });
  });
});
