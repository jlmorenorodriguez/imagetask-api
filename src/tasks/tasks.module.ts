import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { Task, TaskSchema } from './entities/task.entity';
import { ImageProcessingProcessor } from '../images/processors/image-processing.processor';
import { ImagesModule } from '../images/images.module';

@Module({
  imports: [
    // MongoDB schema registration
    MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),

    // Bull queue registration for image processing
    BullModule.registerQueue({
      name: 'image-processing',
    }),

    // Images module for processing services
    ImagesModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, ImageProcessingProcessor],
  exports: [TasksService, MongooseModule],
})
export class TasksModule {}
