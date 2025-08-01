import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus, ImageVariant } from '../entities/task.entity';

export class ImageVariantDto {
  @ApiProperty({
    description: 'Image resolution in pixels',
    example: '1024',
  })
  resolution: string;

  @ApiProperty({
    description: 'Path to the processed image file',
    example: '/output/image1/1024/f322b730b287da77e1c519c7ffef4fc2.jpg',
  })
  path: string;
}

export class TaskResponseDto {
  @ApiProperty({
    description: 'Unique task identifier',
    example: '65d4a54b89c5e342b2c2c5f6',
  })
  taskId: string;

  @ApiProperty({
    description: 'Current task status',
    enum: TaskStatus,
    example: TaskStatus.PENDING,
  })
  status: TaskStatus;

  @ApiProperty({
    description: 'Price associated with the task processing',
    example: 25.5,
    minimum: 0,
  })
  price: number;

  @ApiProperty({
    description: 'Array of processed image variants (only when completed)',
    type: [ImageVariantDto],
    required: false,
  })
  images?: ImageVariantDto[];

  @ApiProperty({
    description: 'Error message if task failed',
    example: 'Failed to process image: Invalid format',
    required: false,
  })
  errorMessage?: string;

  @ApiProperty({
    description: 'Task creation timestamp',
    example: '2024-06-01T12:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Task last update timestamp',
    example: '2024-06-01T12:10:00.000Z',
  })
  updatedAt: Date;
}

export class CreateTaskResponseDto {
  @ApiProperty({
    description: 'Unique task identifier',
    example: '65d4a54b89c5e342b2c2c5f6',
  })
  taskId: string;

  @ApiProperty({
    description: 'Initial task status',
    enum: TaskStatus,
    example: TaskStatus.PENDING,
  })
  status: TaskStatus;

  @ApiProperty({
    description: 'Price associated with the task processing',
    example: 25.5,
    minimum: 0,
  })
  price: number;
}
