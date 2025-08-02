import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import {
  TaskResponseDto,
  CreateTaskResponseDto,
} from './dto/task-response.dto';

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new image processing task',
    description:
      'Creates a new task for image processing. Accepts both local file paths and HTTP URLs.',
  })
  @ApiResponse({
    status: 201,
    description: 'Task created successfully',
    type: CreateTaskResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data or unsupported image format',
  })
  async createTask(
    @Body() createTaskDto: CreateTaskDto,
  ): Promise<CreateTaskResponseDto> {
    return this.tasksService.createTask(createTaskDto);
  }

  @Get(':taskId')
  @ApiOperation({
    summary: 'Get task status and details',
    description:
      'Retrieves the current status, price, and results of a specific task',
  })
  @ApiParam({
    name: 'taskId',
    description: 'Unique task identifier',
    example: '65d4a54b89c5e342b2c2c5f6',
  })
  @ApiResponse({
    status: 200,
    description: 'Task details retrieved successfully',
    type: TaskResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Task not found',
  })
  @ApiBadRequestResponse({
    description: 'Invalid task ID format',
  })
  async getTaskById(@Param('taskId') taskId: string): Promise<TaskResponseDto> {
    return await this.tasksService.getTaskById(taskId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all tasks',
    description: 'Retrieves a list of all tasks with their current status',
  })
  @ApiResponse({
    status: 200,
    description: 'Tasks retrieved successfully',
    type: [TaskResponseDto],
  })
  async getAllTasks(): Promise<TaskResponseDto[]> {
    return this.tasksService.getAllTasks();
  }
}
