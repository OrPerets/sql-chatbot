export interface ImageProcessingResult {
  extractedText: string;
  hasSQL: boolean;
  error?: string;
}

/**
 * Convert a File object to a base64 data URL
 * @param file - The image file to convert
 * @returns Promise with base64 data URL
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Validate if a file is a supported image format
 * @param file - The file to validate
 * @returns boolean indicating if the file is valid
 */
export function isValidImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 20 * 1024 * 1024; // 20MB limit
  
  return validTypes.includes(file.type) && file.size <= maxSize;
} 