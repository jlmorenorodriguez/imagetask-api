import {
  IsString,
  IsNotEmpty,
  IsUrl,
  IsOptional,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({
    description: 'Path to the original image file or URL',
    example: '/path/to/image.jpg',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  originalPath: string;
}

export class CreateTaskFromUrlDto {
  @ApiProperty({
    description: 'URL of the image to process',
    example: 'https://example.com/image.jpg',
    required: true,
  })
  @IsUrl({}, { message: 'Please provide a valid URL' })
  @IsNotEmpty()
  @Matches(/\.(jpg|jpeg|png|webp)$/i, {
    message: 'URL must point to a valid image file (jpg, jpeg, png, webp)',
  })
  imageUrl: string;
}
