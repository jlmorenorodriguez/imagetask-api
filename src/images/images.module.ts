import { Module } from '@nestjs/common';
import { ImageProcessingService } from './services/image-processing.service';
import { FileStorageService } from './services/file-storage.service';
import { ImageDownloadService } from './services/image-download.service';

@Module({
  providers: [ImageProcessingService, FileStorageService, ImageDownloadService],
  exports: [ImageProcessingService, FileStorageService, ImageDownloadService],
})
export class ImagesModule {}
