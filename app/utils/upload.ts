import fs from 'fs';
import path from 'path';

const writeFile = fs.promises.writeFile;
const mkdir = fs.promises.mkdir;
const exists = fs.promises.access;

// Ensure uploads directory exists
export async function ensureUploadsDir() {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  try {
    await exists(uploadsDir);
  } catch {
    await mkdir(uploadsDir, { recursive: true });
  }
  return uploadsDir;
}

// Validate image file
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Only JPEG and PNG files are allowed.' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 5MB limit.' };
  }

  return { valid: true };
}

// Validate audio file
export function validateAudioFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/webm'];
  const maxSize = 10 * 1024 * 1024; // 10MB (approximate for 1 minute audio)

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Only MP3 and WebM files are allowed.' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'Audio file too large. Maximum 1 minute duration allowed.' };
  }

  return { valid: true };
}

// Sanitize filename
export function sanitizeFilename(filename: string): string {
  // Remove path separators and dangerous characters
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  // Add timestamp to avoid conflicts
  const timestamp = Date.now();
  const ext = path.extname(sanitized);
  const name = path.basename(sanitized, ext);
  return `${name}_${timestamp}${ext}`;
}

// Save file to uploads directory
export async function saveFile(file: File, type: 'image' | 'audio'): Promise<string> {
  try {
    const uploadsDir = await ensureUploadsDir();
    const sanitizedName = sanitizeFilename(file.name);
    const filePath = path.join(uploadsDir, type, sanitizedName);
    
    // Ensure subdirectory exists
    const subDir = path.join(uploadsDir, type);
    try {
      await exists(subDir);
    } catch {
      await mkdir(subDir, { recursive: true });
    }

    // Convert file to buffer and save
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    await writeFile(filePath, buffer);

    // Return public URL
    return `/uploads/${type}/${sanitizedName}`;
  } catch (error) {
    console.error('Error saving file:', error);
    throw new Error(`Failed to save ${type} file: ${error.message}`);
  }
}

// Validate authentication token
export function validateAuthToken(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  // Simple bearer token validation - you should implement proper JWT validation
  const token = authHeader.replace('Bearer ', '');
  
  // For now, just check if token exists and has reasonable length
  // In production, validate against your auth system
  return token && token.length > 10;
} 