import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { Task, TaskSchema } from './entities/task.entity';

@Module({
  imports: [
    // MongoDB schema registration
    MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),

    // Bull queue registration for image processing
    BullModule.registerQueue({
      name: 'image-processing',
    }),
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService, MongooseModule],
})
export class TasksModule {}
