import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bull';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { Task, TaskStatus } from '../src/tasks/entities/task.entity';
import { ImageProcessingProcessor } from '../src/images/processors/image-processing.processor';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let mockTaskModel: any;
  let mockQueue: any;

  const mockTask = {
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
    mockTaskModel = jest.fn().mockImplementation(() => ({
      ...mockTask,
      save: mockTask.save,
    }));

    // Mock static methods
    mockTaskModel.find = jest.fn();
    mockTaskModel.findById = jest.fn();
    mockTaskModel.findByIdAndUpdate = jest.fn();

    // Mock Bull Queue
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getModelToken(Task.name))
      .useValue(mockTaskModel)
      .overrideProvider(getQueueToken('image-processing'))
      .useValue(mockQueue)
      .overrideProvider(ImageProcessingProcessor)
      .useValue({
        handleImageProcessing: jest.fn(),
        handleImageProcessingFromUrl: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();

    // Apply same validation pipe as in main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Enable CORS for tests
    app.enableCors();

    await app.init();
  });

  afterEach(async () => {
    await app.close();
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

      it('should validate required fields', () => {
        return request(app.getHttpServer())
          .post('/tasks')
          .send({})
          .expect(400)
          .expect((res) => {
            expect(res.body).toHaveProperty('message');
            expect(Array.isArray(res.body.message)).toBe(true);
          });
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
          ...mockTask,
          images: [
            { resolution: '1024', path: '/output/test/1024/hash.jpg' },
            { resolution: '800', path: '/output/test/800/hash.jpg' },
          ],
          status: TaskStatus.COMPLETED,
        };

        mockTaskModel.findById.mockReturnValue({
          exec: jest.fn().mockResolvedValue(taskResponse),
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
          });
      });

      it('should return 404 when task not found', () => {
        mockTaskModel.findById.mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        });

        return request(app.getHttpServer())
          .get('/tasks/507f1f77bcf86cd799439011')
          .expect(404)
          .expect((res) => {
            expect(res.body).toHaveProperty('message');
            expect(res.body.message).toContain('not found');
          });
      });

      it('should validate ObjectId format', () => {
        // Mock findById to throw error for invalid ObjectId
        mockTaskModel.findById.mockReturnValue({
          exec: jest.fn().mockRejectedValue(new Error('Invalid ObjectId')),
        });

        return request(app.getHttpServer())
          .get('/tasks/invalid-id')
          .expect(500);
      });
    });

    describe('GET /tasks', () => {
      it('should return all tasks', () => {
        const mockTasks = [
          { ...mockTask, _id: { toString: () => '1' } },
          { ...mockTask, _id: { toString: () => '2' } },
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
            res.body.forEach((task: any) => {
              expect(task).toHaveProperty('taskId');
              expect(task).toHaveProperty('status');
              expect(task).toHaveProperty('price');
              expect(task).toHaveProperty('createdAt');
              expect(task).toHaveProperty('updatedAt');
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

  describe('CORS and Headers', () => {
    it('should include CORS headers', () => {
      return request(app.getHttpServer())
        .options('/tasks')
        .expect((res) => {
          // CORS headers should be present
          expect(res.headers).toHaveProperty('access-control-allow-origin');
        });
    });
  });
});
