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
import {
  ImageVariant,
  Task,
  TaskDocument,
  TaskStatus,
} from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import {
  TaskResponseDto,
  CreateTaskResponseDto,
} from './dto/task-response.dto';

/**
 * Interface for job data when processing local image files
 */
interface ProcessImageJobData {
  taskId: string;
  originalPath: string;
}

/**
 * Interface for job data when processing images from URLs
 */
interface ProcessImageFromUrlJobData {
  taskId: string;
  imageUrl: string;
}

/**
 * Union type for all possible job data types
 */
type ImageProcessingJobData = ProcessImageJobData | ProcessImageFromUrlJobData;

/**
 * Interface for task update data
 */
interface TaskUpdateData {
  status: TaskStatus;
  updatedAt: Date;
  images?: ImageVariant[];
  errorMessage?: string;
}

/**
 * Interface for Mongoose error with name property
 */
interface MongooseError extends Error {
  name: string;
}

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
      const { jobType, jobData } = this.createJobData(
        savedTask._id.toString(),
        createTaskDto.originalPath,
        isUrl,
      );

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
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(`Error creating task: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Create job data based on whether the input is a URL or local path
   */
  private createJobData(
    taskId: string,
    originalPath: string,
    isUrl: boolean,
  ): {
    jobType: string;
    jobData: ImageProcessingJobData;
  } {
    if (isUrl) {
      return {
        jobType: 'process-image-from-url',
        jobData: {
          taskId,
          imageUrl: originalPath,
        },
      };
    } else {
      return {
        jobType: 'process-image',
        jobData: {
          taskId,
          originalPath,
        },
      };
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
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(`Error retrieving task ${taskId}: ${errorMessage}`);

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Handle specific Mongoose errors
      if (this.isMongooseError(error) && error.name === 'CastError') {
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
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(`Error retrieving all tasks: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    images?: ImageVariant[],
    errorMessage?: string,
  ): Promise<void> {
    try {
      // Validate ObjectId format
      if (!Types.ObjectId.isValid(taskId)) {
        throw new Error(`Invalid ObjectId format: ${taskId}`);
      }

      const updateData: TaskUpdateData = {
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
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(`Error updating task ${taskId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Extract error message safely from unknown error
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * Type guard to check if error is a Mongoose error
   */
  private isMongooseError(error: unknown): error is MongooseError {
    return error instanceof Error && 'name' in error;
  }
}
