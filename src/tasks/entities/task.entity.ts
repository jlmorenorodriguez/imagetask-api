import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TaskDocument = Task & Document;

export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface ImageVariant {
  resolution: string;
  path: string;
}

@Schema({ timestamps: true })
export class Task {
  @Prop({ required: true, enum: TaskStatus, default: TaskStatus.PENDING })
  status: TaskStatus;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true })
  originalPath: string;

  @Prop({ type: String, required: false })
  errorMessage?: string;

  @Prop([
    {
      resolution: { type: String, required: true },
      path: { type: String, required: true },
    },
  ])
  images: ImageVariant[];

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

// Create indexes for efficient queries
TaskSchema.index({ status: 1, createdAt: -1 });
TaskSchema.index({ updatedAt: -1 });
