import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bull';
import { Model } from 'mongoose';
import {
  ImageVariant,
  Task,
  TaskDocument,
  TaskStatus,
} from '../../tasks/entities/task.entity';
import { ImageProcessingService } from '../../images/services/image-processing.service';

interface ProcessImageJob {
  taskId: string;
  originalPath: string;
}

interface ProcessImageFromUrlJob {
  taskId: string;
  imageUrl: string;
}

interface TaskUpdateData {
  status: TaskStatus;
  updatedAt: Date;
  images?: ImageVariant[];
  errorMessage?: string;
}

@Injectable()
@Processor('image-processing')
export class ImageProcessingProcessor {
  private readonly logger = new Logger(ImageProcessingProcessor.name);

  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    private readonly imageProcessingService: ImageProcessingService,
  ) {}

  /**
   * Process image from local file path
   */
  @Process('process-image')
  async handleImageProcessing(job: Job<ProcessImageJob>): Promise<void> {
    const { taskId, originalPath } = job.data;

    this.logger.log(`Processing image job for task ${taskId}: ${originalPath}`);

    try {
      // Update task status to processing
      await this.updateTaskStatus(taskId, TaskStatus.PROCESSING);

      // Process the image
      const result = await this.imageProcessingService.processImageFromPath(
        taskId,
        originalPath,
      );

      if (result.success) {
        // Update task with completed status and images
        await this.updateTaskStatus(
          taskId,
          TaskStatus.COMPLETED,
          result.images,
        );
        this.logger.log(
          `Task ${taskId} completed successfully with ${result.images?.length} variants`,
        );
      } else {
        // Update task with failed status
        await this.updateTaskStatus(
          taskId,
          TaskStatus.FAILED,
          undefined,
          result.error,
        );
        this.logger.error(`Task ${taskId} failed: ${result.error}`);
      }
    } catch (error) {
      this.logger.error(
        `Unexpected error processing task ${taskId}: ${error.message}`,
      );
      await this.updateTaskStatus(
        taskId,
        TaskStatus.FAILED,
        undefined,
        `Unexpected error: ${error.message}`,
      );
    }
  }

  /**
   * Process image from URL
   */
  @Process('process-image-from-url')
  async handleImageProcessingFromUrl(
    job: Job<ProcessImageFromUrlJob>,
  ): Promise<void> {
    const { taskId, imageUrl } = job.data;

    this.logger.log(
      `Processing image from URL job for task ${taskId}: ${imageUrl}`,
    );

    try {
      // Update task status to processing
      await this.updateTaskStatus(taskId, TaskStatus.PROCESSING);

      // Process the image from URL
      const result = await this.imageProcessingService.processImageFromUrl(
        taskId,
        imageUrl,
      );

      if (result.success) {
        // Update task with completed status and images
        await this.updateTaskStatus(
          taskId,
          TaskStatus.COMPLETED,
          result.images,
        );
        this.logger.log(
          `URL task ${taskId} completed successfully with ${result.images?.length} variants`,
        );
      } else {
        // Update task with failed status
        await this.updateTaskStatus(
          taskId,
          TaskStatus.FAILED,
          undefined,
          result.error,
        );
        this.logger.error(`URL task ${taskId} failed: ${result.error}`);
      }
    } catch (error) {
      this.logger.error(
        `Unexpected error processing URL task ${taskId}: ${error.message}`,
      );
      await this.updateTaskStatus(
        taskId,
        TaskStatus.FAILED,
        undefined,
        `Unexpected error: ${error.message}`,
      );
    }
  }

  /**
   * Update task status in database
   */
  private async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    images?: ImageVariant[],
    errorMessage?: string,
  ): Promise<void> {
    try {
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

      await this.taskModel.findByIdAndUpdate(taskId, updateData).exec();
      this.logger.log(`Task ${taskId} status updated to: ${status}`);
    } catch (error) {
      this.logger.error(
        `Error updating task ${taskId} status: ${error.message}`,
      );
      throw error;
    }
  }
}
