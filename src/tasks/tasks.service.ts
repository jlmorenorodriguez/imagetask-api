import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Model, Types } from 'mongoose';
import { Queue } from 'bull';
import { Task, TaskDocument, TaskStatus } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import {
  TaskResponseDto,
  CreateTaskResponseDto,
} from './dto/task-response.dto';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectQueue('image-processing') private imageProcessingQueue: Queue,
  ) {}

  /**
   * Create a new image processing task (supports both local paths and URLs)
   */
  async createTask(
    createTaskDto: CreateTaskDto,
  ): Promise<CreateTaskResponseDto> {
    try {
      // Generate random price between 5 and 50
      const price = Math.round((Math.random() * 45 + 5) * 100) / 100;

      // Create task in database
      const task = new this.taskModel({
        originalPath: createTaskDto.originalPath,
        price,
        status: TaskStatus.PENDING,
        images: [],
      });

      const savedTask = await task.save();
      this.logger.log(`Task created with ID: ${savedTask._id}`);

      // Determine if it's a URL or local path and add appropriate job to queue
      const isUrl = this.isValidUrl(createTaskDto.originalPath);
      const jobType = isUrl ? 'process-image-from-url' : 'process-image';
      const jobData = isUrl
        ? {
            taskId: savedTask._id.toString(),
            imageUrl: createTaskDto.originalPath,
          }
        : {
            taskId: savedTask._id.toString(),
            originalPath: createTaskDto.originalPath,
          };

      await this.imageProcessingQueue.add(jobType, jobData);

      this.logger.log(
        `${jobType} job added to queue for task: ${savedTask._id}`,
      );

      return {
        taskId: savedTask._id.toString(),
        status: savedTask.status,
        price: savedTask.price,
      };
    } catch (error) {
      this.logger.error(`Error creating task: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if string is a valid URL
   */
  private isValidUrl(string: string): boolean {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Get task by ID
   */
  async getTaskById(taskId: string): Promise<TaskResponseDto | null> {
    try {
      // Validate ObjectId format first
      if (!Types.ObjectId.isValid(taskId)) {
        throw new BadRequestException('Invalid format ID');
      }

      this.logger.log(`Searching for task with ID: ${taskId}`);

      const task = await this.taskModel.findOne({ _id: taskId }).lean().exec();

      if (!task) {
        this.logger.log(`Task not found: ${taskId}`);
        throw new NotFoundException(`Task not found: ${taskId}`);
      }

      this.logger.log(`Task found successfully: ${taskId}`);

      return {
        taskId: task._id.toString(),
        status: task.status,
        price: task.price,
        images: task.images,
        errorMessage: task.errorMessage,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Error retrieving task ${taskId}: ${error.message}`);

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Handle specific Mongoose errors
      if (error.name === 'CastError') {
        throw new BadRequestException('Error in task ID format');
      }

      // Handle any other unexpected errors
      throw new BadRequestException('Internal error processing request');
    }
  }

  /**
   * Get all tasks
   */
  async getAllTasks(): Promise<TaskResponseDto[]> {
    try {
      const tasks = await this.taskModel.find().sort({ createdAt: -1 }).exec();

      return tasks.map((task) => ({
        taskId: task._id.toString(),
        status: task.status,
        price: task.price,
        images: task.images,
        errorMessage: task.errorMessage,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      }));
    } catch (error) {
      this.logger.error(`Error retrieving all tasks: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    images?: any[],
    errorMessage?: string,
  ): Promise<void> {
    try {
      // Validate ObjectId format
      if (!Types.ObjectId.isValid(taskId)) {
        throw new Error(`Invalid ObjectId format: ${taskId}`);
      }

      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      if (images) {
        updateData.images = images;
      }

      if (errorMessage) {
        updateData.errorMessage = errorMessage;
      }

      const result = await this.taskModel
        .findByIdAndUpdate(taskId, updateData)
        .exec();

      if (!result) {
        this.logger.warn(`Task not found for update: ${taskId}`);
        throw new Error(`Task not found: ${taskId}`);
      }

      this.logger.log(`Task ${taskId} status updated to: ${status}`);
    } catch (error) {
      this.logger.error(`Error updating task ${taskId}: ${error.message}`);
      throw error;
    }
  }
}
