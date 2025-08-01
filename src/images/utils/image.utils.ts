/**
 * Image processing utilities
 */

export const IMAGE_CONSTANTS = {
  SUPPORTED_FORMATS: ['jpg', 'jpeg', 'png', 'webp'] as const,
  SUPPORTED_MIME_TYPES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ] as const,
  MAX_FILE_SIZE: 10485760, // 10MB in bytes
  MIN_DIMENSIONS: { width: 100, height: 100 },
  MAX_DIMENSIONS: { width: 10000, height: 10000 },
  DEFAULT_QUALITY: 90,
  DEFAULT_RESOLUTIONS: ['1024', '800'] as const,
} as const;

/**
 * Check if file extension is supported
 */
export function isSupportedImageFormat(extension: string): boolean {
  return (IMAGE_CONSTANTS.SUPPORTED_FORMATS as readonly string[]).includes(
    extension.toLowerCase(),
  );
}

/**
 * Check if MIME type is supported
 */
export function isSupportedMimeType(mimeType: string): boolean {
  return (IMAGE_CONSTANTS.SUPPORTED_MIME_TYPES as readonly string[]).some(
    (type) => mimeType.toLowerCase().includes(type),
  );
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

/**
 * Generate output directory path
 */
export function generateOutputPath(
  baseDir: string,
  taskId: string,
  resolution: string,
): string {
  return `${baseDir}/${taskId}/${resolution}`;
}

/**
 * Format file size for human reading
 */
export function formatFileSize(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(2);

  return `${size} ${sizes[i]}`;
}

/**
 * Validate image dimensions
 */
export function validateImageDimensions(
  width: number,
  height: number,
): { isValid: boolean; error?: string } {
  if (
    width < IMAGE_CONSTANTS.MIN_DIMENSIONS.width ||
    height < IMAGE_CONSTANTS.MIN_DIMENSIONS.height
  ) {
    return {
      isValid: false,
      error: `Image too small. Minimum size: ${IMAGE_CONSTANTS.MIN_DIMENSIONS.width}x${IMAGE_CONSTANTS.MIN_DIMENSIONS.height}px`,
    };
  }

  if (
    width > IMAGE_CONSTANTS.MAX_DIMENSIONS.width ||
    height > IMAGE_CONSTANTS.MAX_DIMENSIONS.height
  ) {
    return {
      isValid: false,
      error: `Image too large. Maximum size: ${IMAGE_CONSTANTS.MAX_DIMENSIONS.width}x${IMAGE_CONSTANTS.MAX_DIMENSIONS.height}px`,
    };
  }

  return { isValid: true };
}

/**
 * Calculate target dimensions maintaining aspect ratio
 */
export function calculateTargetDimensions(
  originalWidth: number,
  originalHeight: number,
  targetWidth: number,
): { width: number; height: number } {
  const aspectRatio = originalHeight / originalWidth;
  const targetHeight = Math.round(targetWidth * aspectRatio);

  return { width: targetWidth, height: targetHeight };
}
