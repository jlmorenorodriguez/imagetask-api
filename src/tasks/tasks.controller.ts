import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
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
import { CreateTaskDto, CreateTaskFromUrlDto } from './dto/create-task.dto';
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
      'Creates a new task for image processing with a randomly assigned price',
  })
  @ApiResponse({
    status: 201,
    description: 'Task created successfully',
    type: CreateTaskResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
  })
  async createTask(
    @Body() createTaskDto: CreateTaskDto,
  ): Promise<CreateTaskResponseDto> {
    return this.tasksService.createTask(createTaskDto);
  }

  @Post('from-url')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new image processing task from URL',
    description:
      'Creates a new task for image processing by downloading from URL',
  })
  @ApiResponse({
    status: 201,
    description: 'Task created successfully from URL',
    type: CreateTaskResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid URL or unsupported image format',
  })
  async createTaskFromUrl(
    @Body() createTaskFromUrlDto: CreateTaskFromUrlDto,
  ): Promise<CreateTaskResponseDto> {
    return this.tasksService.createTaskFromUrl(createTaskFromUrlDto);
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
  async getTaskById(@Param('taskId') taskId: string): Promise<TaskResponseDto> {
    const task = await this.tasksService.getTaskById(taskId);
    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }
    return task;
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
