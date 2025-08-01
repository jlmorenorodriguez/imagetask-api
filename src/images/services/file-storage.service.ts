import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly outputDir = process.env.OUTPUT_DIRECTORY || './output';

  /**
   * Ensure directory exists, create if not
   */
  async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
      this.logger.log(`Directory created: ${dirPath}`);
    }
  }

  /**
   * Generate MD5 hash from buffer
   */
  generateMd5Hash(buffer: Buffer): string {
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  /**
   * Get file extension from filename or path
   */
  getFileExtension(filename: string): string {
    return path.extname(filename).toLowerCase().replace('.', '');
  }

  /**
   * Generate output path structure: /output/{taskId}/{resolution}/
   */
  generateOutputPath(taskId: string, resolution: string): string {
    return path.join(this.outputDir, taskId, resolution);
  }

  /**
   * Generate full file path with MD5 hash as filename
   */
  generateFilePath(
    taskId: string,
    resolution: string,
    md5Hash: string,
    extension: string,
  ): string {
    const outputPath = this.generateOutputPath(taskId, resolution);
    return path.join(outputPath, `${md5Hash}.${extension}`);
  }

  /**
   * Save processed image buffer to file
   */
  async saveImage(
    taskId: string,
    resolution: string,
    imageBuffer: Buffer,
    originalExtension: string,
  ): Promise<string> {
    try {
      // Generate MD5 hash for filename
      const md5Hash = this.generateMd5Hash(imageBuffer);

      // Create output directory structure
      const outputPath = this.generateOutputPath(taskId, resolution);
      await this.ensureDirectoryExists(outputPath);

      // Generate full file path
      const filePath = this.generateFilePath(
        taskId,
        resolution,
        md5Hash,
        originalExtension,
      );

      // Save file
      await fs.writeFile(filePath, imageBuffer);

      this.logger.log(`Image saved: ${filePath}`);
      return filePath;
    } catch (error) {
      this.logger.error(`Error saving image: ${error.message}`);
      throw new Error(`Failed to save image: ${error.message}`);
    }
  }

  /**
   * Read file and return buffer
   */
  async readFile(filePath: string): Promise<Buffer> {
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      this.logger.error(`Error reading file ${filePath}: ${error.message}`);
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      this.logger.log(`File deleted: ${filePath}`);
    } catch (error) {
      this.logger.error(`Error deleting file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Clean up task directory (useful for failed tasks)
   */
  async cleanupTaskDirectory(taskId: string): Promise<void> {
    try {
      const taskDir = path.join(this.outputDir, taskId);
      await fs.rmdir(taskDir, { recursive: true });
      this.logger.log(`Task directory cleaned up: ${taskDir}`);
    } catch (error) {
      this.logger.error(`Error cleaning up task directory: ${error.message}`);
    }
  }
}
