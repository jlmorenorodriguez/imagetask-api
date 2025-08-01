import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({
    description:
      'Path to the original image file (local path) or URL to download',
    examples: {
      localPath: {
        summary: 'Local file path',
        value: '/path/to/image.jpg',
      },
      httpUrl: {
        summary: 'HTTP URL',
        value: 'https://example.com/image.jpg',
      },
    },
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  originalPath: string;
}
