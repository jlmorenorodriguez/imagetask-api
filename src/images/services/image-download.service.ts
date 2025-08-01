import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

@Injectable()
export class ImageDownloadService {
  private readonly logger = new Logger(ImageDownloadService.name);
  private readonly maxFileSize =
    parseInt(process.env.MAX_FILE_SIZE) || 10485760; // 10MB default
  private readonly supportedFormats = process.env.SUPPORTED_FORMATS?.split(
    ',',
  ) || ['jpg', 'jpeg', 'png', 'webp'];

  /**
   * Download image from URL and return buffer
   */
  async downloadImage(
    imageUrl: string,
  ): Promise<{ buffer: Buffer; extension: string }> {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(imageUrl);
        const client = url.protocol === 'https:' ? https : http;

        this.logger.log(`Starting download from: ${imageUrl}`);

        const request = client.get(url, (response) => {
          // Check response status
          if (response.statusCode !== 200) {
            reject(
              new Error(
                `HTTP error: ${response.statusCode} ${response.statusMessage}`,
              ),
            );
            return;
          }

          // Check content type
          const contentType = response.headers['content-type'];
          if (!this.isValidImageContentType(contentType)) {
            reject(new Error(`Unsupported content type: ${contentType}`));
            return;
          }

          // Check content length
          const contentLength = parseInt(
            response.headers['content-length'] || '0',
          );
          if (contentLength > this.maxFileSize) {
            reject(
              new Error(`File size exceeds limit: ${contentLength} bytes`),
            );
            return;
          }

          const chunks: Buffer[] = [];
          let downloadedBytes = 0;

          response.on('data', (chunk: Buffer) => {
            downloadedBytes += chunk.length;

            // Check size limit during download
            if (downloadedBytes > this.maxFileSize) {
              reject(
                new Error(
                  `Download size exceeds limit: ${downloadedBytes} bytes`,
                ),
              );
              return;
            }

            chunks.push(chunk);
          });

          response.on('end', () => {
            try {
              const buffer = Buffer.concat(chunks);
              const extension =
                this.extractExtensionFromUrl(imageUrl) ||
                this.getExtensionFromContentType(contentType);

              this.logger.log(`Download completed: ${downloadedBytes} bytes`);
              resolve({ buffer, extension });
            } catch (error) {
              reject(
                new Error(`Error processing downloaded data: ${error.message}`),
              );
            }
          });

          response.on('error', (error) => {
            reject(new Error(`Download error: ${error.message}`));
          });
        });

        request.on('error', (error) => {
          reject(new Error(`Request error: ${error.message}`));
        });

        // Set timeout
        request.setTimeout(30000, () => {
          request.destroy();
          reject(new Error('Download timeout'));
        });
      } catch (error) {
        reject(new Error(`Invalid URL or request setup: ${error.message}`));
      }
    });
  }

  /**
   * Check if content type is a valid image
   */
  private isValidImageContentType(contentType: string | undefined): boolean {
    if (!contentType) return false;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    return validTypes.some((type) => contentType.toLowerCase().includes(type));
  }

  /**
   * Extract file extension from URL
   */
  private extractExtensionFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const extension = pathname.split('.').pop()?.toLowerCase();

      if (extension && this.supportedFormats.includes(extension)) {
        return extension;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get file extension from content type
   */
  private getExtensionFromContentType(contentType: string | undefined): string {
    if (!contentType) return 'jpg';

    const contentTypeLower = contentType.toLowerCase();

    if (contentTypeLower.includes('png')) return 'png';
    if (contentTypeLower.includes('webp')) return 'webp';
    if (contentTypeLower.includes('jpeg') || contentTypeLower.includes('jpg'))
      return 'jpg';

    return 'jpg'; // default fallback
  }

  /**
   * Validate if URL points to a supported image format
   */
  validateImageUrl(imageUrl: string): { isValid: boolean; error?: string } {
    try {
      const url = new URL(imageUrl);

      // Check protocol
      if (!['http:', 'https:'].includes(url.protocol)) {
        return {
          isValid: false,
          error: 'Only HTTP and HTTPS URLs are supported',
        };
      }

      // Check if URL has a valid image extension
      const extension = this.extractExtensionFromUrl(imageUrl);
      if (extension && !this.supportedFormats.includes(extension)) {
        return {
          isValid: false,
          error: `Unsupported image format: ${extension}`,
        };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Invalid URL format' };
    }
  }
}
