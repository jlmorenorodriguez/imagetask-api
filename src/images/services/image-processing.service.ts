import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';
import { FileStorageService } from './file-storage.service';
import { ImageDownloadService } from './image-download.service';
import { ImageVariant } from '../../tasks/entities/task.entity';

export interface ProcessingResult {
  success: boolean;
  images?: ImageVariant[];
  error?: string;
}

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);
  private readonly resolutions = process.env.IMAGE_RESOLUTIONS?.split(',') || [
    '1024',
    '800',
  ];

  constructor(
    private readonly fileStorageService: FileStorageService,
    private readonly imageDownloadService: ImageDownloadService,
  ) {}

  /**
   * Process image from local file path
   */
  async processImageFromPath(
    taskId: string,
    originalPath: string,
  ): Promise<ProcessingResult> {
    try {
      this.logger.log(`Processing image from path: ${originalPath}`);

      // Check if file exists
      const fileExists = await this.fileStorageService.fileExists(originalPath);
      if (!fileExists) {
        return { success: false, error: `File not found: ${originalPath}` };
      }

      // Read original image
      const imageBuffer = await this.fileStorageService.readFile(originalPath);
      const extension = this.fileStorageService.getFileExtension(originalPath);

      // Validate image format
      const validationResult = await this.validateImageBuffer(imageBuffer);
      if (!validationResult.isValid) {
        return { success: false, error: validationResult.error };
      }

      // Process variants
      return await this.processImageVariants(taskId, imageBuffer, extension);
    } catch (error) {
      this.logger.error(`Error processing image from path: ${error.message}`);
      return { success: false, error: `Processing failed: ${error.message}` };
    }
  }

  /**
   * Process image from URL
   */
  async processImageFromUrl(
    taskId: string,
    imageUrl: string,
  ): Promise<ProcessingResult> {
    try {
      this.logger.log(`Processing image from URL: ${imageUrl}`);

      // Validate URL
      const urlValidation =
        this.imageDownloadService.validateImageUrl(imageUrl);
      if (!urlValidation.isValid) {
        return { success: false, error: urlValidation.error };
      }

      // Download image
      const { buffer: imageBuffer, extension } =
        await this.imageDownloadService.downloadImage(imageUrl);

      // Validate downloaded image
      const validationResult = await this.validateImageBuffer(imageBuffer);
      if (!validationResult.isValid) {
        return { success: false, error: validationResult.error };
      }

      // Process variants
      return await this.processImageVariants(taskId, imageBuffer, extension);
    } catch (error) {
      this.logger.error(`Error processing image from URL: ${error.message}`);
      return {
        success: false,
        error: `URL processing failed: ${error.message}`,
      };
    }
  }

  /**
   * Process image variants for different resolutions
   */
  private async processImageVariants(
    taskId: string,
    originalBuffer: Buffer,
    extension: string,
  ): Promise<ProcessingResult> {
    try {
      const images: ImageVariant[] = [];
      const originalImage = sharp(originalBuffer);

      // Get original image metadata
      const metadata = await originalImage.metadata();
      this.logger.log(
        `Original image: ${metadata.width}x${metadata.height}, format: ${metadata.format}`,
      );

      // Process each resolution
      for (const resolution of this.resolutions) {
        try {
          const targetWidth = parseInt(resolution);

          // Skip if original is smaller than target resolution
          if (metadata.width && metadata.width < targetWidth) {
            this.logger.warn(
              `Skipping resolution ${resolution}px - original image is smaller (${metadata.width}px)`,
            );
            continue;
          }

          // Resize image maintaining aspect ratio
          const resizedBuffer = await originalImage
            .resize(targetWidth, null, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .jpeg({ quality: 90 }) // Convert to JPEG for consistency
            .toBuffer();

          // Save resized image
          const filePath = await this.fileStorageService.saveImage(
            taskId,
            resolution,
            resizedBuffer,
            'jpg', // Always save as JPG for consistency
          );

          images.push({
            resolution,
            path: filePath,
          });

          this.logger.log(`Variant created: ${resolution}px -> ${filePath}`);
        } catch (variantError) {
          this.logger.error(
            `Error creating ${resolution}px variant: ${variantError.message}`,
          );
          // Continue with other resolutions even if one fails
        }
      }

      if (images.length === 0) {
        return { success: false, error: 'No image variants could be created' };
      }

      return { success: true, images };
    } catch (error) {
      this.logger.error(`Error processing image variants: ${error.message}`);
      return {
        success: false,
        error: `Variant processing failed: ${error.message}`,
      };
    }
  }

  /**
   * Validate image buffer using Sharp
   */
  private async validateImageBuffer(
    buffer: Buffer,
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      // Check if it's a valid image
      if (!metadata.format) {
        return { isValid: false, error: 'Invalid image format' };
      }

      // Check supported formats
      const supportedFormats = ['jpeg', 'jpg', 'png', 'webp'];
      if (!supportedFormats.includes(metadata.format.toLowerCase())) {
        return {
          isValid: false,
          error: `Unsupported format: ${metadata.format}`,
        };
      }

      // Check minimum dimensions
      if (
        !metadata.width ||
        !metadata.height ||
        metadata.width < 100 ||
        metadata.height < 100
      ) {
        return { isValid: false, error: 'Image too small (minimum 100x100px)' };
      }

      // Check maximum dimensions
      if (metadata.width > 10000 || metadata.height > 10000) {
        return {
          isValid: false,
          error: 'Image too large (maximum 10000x10000px)',
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `Image validation failed: ${error.message}`,
      };
    }
  }

  /**
   * Get image information without processing
   */
  async getImageInfo(buffer: Buffer): Promise<sharp.Metadata> {
    try {
      const image = sharp(buffer);
      return await image.metadata();
    } catch (error) {
      this.logger.error(`Error getting image info: ${error.message}`);
      throw error;
    }
  }
}
